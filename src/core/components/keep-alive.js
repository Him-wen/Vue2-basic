/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}
/**
 * 并且我们的组件名如果满足了配置 include 且不匹配或者是配置了 exclude 且匹配，那么就直接返回这个组件的 vnode，否则的话走下一步缓存：
 * @param {*} pattern 
 * @param {*} name 
 * @returns 
 */
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {// 数组
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {// 字符串
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {// 正则表达式情况
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
// 其实就是对 cache 做遍历
//@param this, name => matches(val, name)
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance// this实例
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {// 如果存在
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {// 发现缓存的节点名称和新的规则没有匹配上的时候，就把这个缓存节点从缓存中摘除
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (// 删除
  cache: VNodeCache,
  key: string,// cache的键
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  // 除了从缓存中删除外，还要判断如果要删除的缓存并的组件 tag 不是当前渲染组件 tag，也执行删除缓存的组件实例的 $destroy 方法
  if (cached && (!current || cached.tag !== current.tag)) {// mounted逻辑
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  abstract: true,// 抽象组件 判断当前组件虚拟dom是否渲染成真实dom的关键

  props: {
    include: patternTypes,// 表示匹配的缓存
    exclude: patternTypes,// 表示匹配的排除
    max: [String, Number]// 缓存的组件
  },

  created () {
    this.cache = Object.create(null)// 缓存已经创建的vnode 虚拟dom
    this.keys = []// 缓存的虚拟dom的键集合
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)// 删除所有的缓存
    }
  },

  mounted () {// 第二个参数是 组件name
    // 实时监听是否缓存的变动
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))// 缓存
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))// 不缓存
    })
  },

  /**
   * 第一步：获取keep-alive包裹着的第一个子组件对象及其组件名；
第二步：根据设定的黑白名单（如果有）进行条件匹配，决定是否缓存。不匹配，直接返回组件实例（VNode），否则执行第三步；
第三步：根据组件ID和tag生成缓存Key，并在缓存对象中查找是否已缓存过该组件实例。如果存在，直接取出缓存值并更新该key在this.keys中的位置（更新key的位置是实现LRU置换策略的关键），否则执行第四步；
第四步：在this.cache对象中存储该组件实例并保存key值，之后检查缓存的实例数量是否超过max设置值，超过则根据LRU置换策略删除最近最久未使用的实例（即是下标为0的那个key）;
第五步：最后并且很重要，将该组件实例的keepAlive属性值设置为true。
   * @returns 
   */

  render () {
    // 第一步 获取第一个子元素的vnode <keep-alive> 只处理第一个子元素
    const slot = this.$slots.default
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {// 存在组件参数
      // check pattern
      const name: ?string = getComponentName(componentOptions)// 获取当前组件的名字
      const { include, exclude } = this
    // 第二步
      if (// 条件匹配
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }
    // 第三步
      const { cache, keys } = this
      // 定义组件的缓存key
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) {// 已经命中过该组件的缓存
        vnode.componentInstance = cache[key].componentInstance// 直接从缓存中拿 vnode的组件实例
        // make current key freshest
        remove(keys, key)
        keys.push(key)// 调整key的顺序放在了最后一个
      } else {
        cache[key] = vnode// 将现在的 vnode 设置进缓存
        keys.push(key)
      // 第四步 prune oldest entry
        if (this.max && keys.length > parseInt(this.max)) {// 如果配置了 max 并且缓存的长度超过了 this.max，还要从缓存中删除第一个
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      // 第五步
      vnode.data.keepAlive = true// 渲染和执行被包裹组件的钩子函数需要用到
    }
    return vnode || (slot && slot[0])
  }
}
