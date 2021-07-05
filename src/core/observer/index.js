/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * /**
 * 观察者类，会被附加到每个被观察的对象上，value.__ob__ = this
 * 而对象的各个属性则会被转换成 getter/setter，并收集依赖和通知更新
 */
 */
// value 以 data 中的数据为例
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 添加一个__ob__属性，并赋值为该 value 的实例，相当于为value打上标记，表示它已经被转化成响应式了，避免重复操作
    // 开发中输出 data 上对象类型的数据，会发现该对象多了一个 __ob__ 的属性
    def(value, '__ob__', this)

    //分对象和数组来进行操作：
    //1.如果是数组处理
    if (Array.isArray(value)) {
      if (hasProto) {// 判断有没有原型
        // value的原型是arrayMethods
        protoAugment(value, arrayMethods)// 从修改的数组原型上面继承的方法
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)// 对数组里面的每一个对象都进行响应式处理
    } else {
      // 2.如果不是数组的处理(对象)
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * 遍历所有属性并将其转化为
   * getter/setters. This method should only be called when
   * 仅在一下情况才执行
   * value type is Object.
   */
  // {
  //   key1:'a',
  //   key2:'b',
  // }
  walk (obj: Object) {
    const keys = Object.keys(obj) // 获取每个 data 的键(key1)
    for (let i = 0; i < keys.length; i++) {// 递归的进行处理
      defineReactive(obj, keys[i])// 第二个参数为 键值(a) 的取值
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {// 对数组进行响应式处理
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 响应式处理的真正入口 （创建Observe实例）
 * 为对象创建观察者实例，如果对象已经被观察过，则返回已有的观察者实例，否则创建新的观察者实例
 * @param {*} value 对象 => {}
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  //给非 VNode 的对象类型数据添加一个 Observer
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果 value 对象上存在 __ob__ 属性，则表示已经做过观察了，直接返回 __ob__ 属性
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建观察者实例
    ob = new Observer(value)// 调用Observer类
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 拦截 obj[key] 的读取 get 和设置 set 操作：
 *   1、在第一次读取时收集依赖，比如执行 render 函数生成虚拟 DOM 时 (updateCompu函数) 会有读取操作
 *   2、在更新时设置新值并通知依赖更新
 */
export function defineReactive (
  obj: Object,(data)
  key: string,(a)
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 实例化 dep，一个 key（键值 a ） 一个 dep (依赖管理器，也可以当作依赖数组来理解)
  const dep = new Dep()

  // 获取 obj[key] 的属性描述符，发现它是不可配置对象的话直接 return
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get // property不为空的情况下 获取get函数
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 递归调用，处理 val 即 obj[key] 的值为对象的情况，保证对象中的所有 key 都被观察，typeof val === 'object'
  let childOb = !shallow && observe(val)

  // 响应式核心
  Object.defineProperty(obj, key, { // data
    enumerable: true,
    configurable: true,
    // get 拦截对 obj[key] 的读取操作 getter函数
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      /**
       * Dep.target 为 Dep 类的一个静态属性，值为 watcher，在实例化 Watcher 时会被设置
       * 实例化 Watcher 时会执行 new Watcher 时传递的回调函数（computed 除外，因为它懒执行）
       * 而回调函数中如果有 vm.key 的读取行为，则会触发这里的 读取 拦截，进行依赖收集
       * 回调函数执行完以后又会将 Dep.target 设置为 null，避免这里重复收集依赖
       */
       if (Dep.target) {// 当在 watcher里面触发了 get方法时，这个就有值了
        // 依赖收集，在 dep 中添加 watcher，也在 watcher 中添加 dep
        dep.depend()
        // childOb 表示对象中嵌套对象的观察者对象，如果存在也对其进行依赖收集
        if (childOb) {
          // 这就是 this.key.chidlKey 被更新时能触发响应式更新的原因
          childOb.dep.depend()
          // 如果是 obj[key] 是 数组，则触发数组响应式
          if (Array.isArray(value)) {
            // 为数组项为对象的项添加依赖
            dependArray(value)
          }
        }
      }
      return value
    },
    // set 拦截对 obj[key] 的设置操作
    set: function reactiveSetter (newVal) {
      // 旧的 obj[key]
      const value = getter ? getter.call(obj) : val
      // 如果新老值一样，则直接 return，不跟新更不触发响应式更新过程
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // setter 不存在说明该属性是一个只读属性，直接 return
      if (getter && !setter) return// !setter表示不存在函数
      if (setter) {
        // 设置新值
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 对新值进行观察，让新值也是响应式的
      childOb = !shallow && observe(newVal)
      // 依赖通知更新
      // 这里是异步更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 在对象上设置属性。 添加新属性，如果该属性尚不存在，则触发更改通知。
 * /**
 * 通过 Vue.set 或者 this.$set 方法给 target 的指定 key 设置值 val
 * 如果 target 是对象，并且 key 原本不存在，则为新 key 设置响应式，然后执行依赖通知
 * 运行时可以添加根组件级别的属性 data(){ key1:1,key2:{}}对象 需要添加一个this.key3:3
 * 这样设置时不具备响应式的，但是key2.key:2.1是可以触发响应式的（key2.key不是根组件），key3可以通过
 * Vue.set(this.'key3',val)使用这个全局方法来进行设置，数组同理，具体可以参考Vue官方文档
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 更新数组指定下标的元素，Vue.set(array, idx, val)，通过 splice 方法实现响应式更新
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  // 更新对象已有属性，Vue.set(obj, key, val)，执行更新即可
  if (key in target && !(key in Object.prototype)) {
    target[key] = val// 只是对旧值更新
    return val
  }
  // 不能向 Vue 实例或者 $data 添加动态添加响应式属性，vmCount 的用处之一，
  // this.$data 的 ob.vmCount = 1，表示根组件，其它子组件的 vm.vmCount 都是 0
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  // 给对象定义新属性，通过 defineReactive 方法设置响应式，并触发依赖更新
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // target 为数组，则通过 splice 方法删除指定下标的元素
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  // 避免删除 Vue 实例的属性或者 $data 的数据
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 如果属性不存在直接结束
  if (!hasOwn(target, key)) {
    return
  }
  // 通过 delete 运算符删除对象的属性
  delete target[key]
  if (!ob) {
    return
  }
  // 执行依赖通知
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 遍历每个数组元素，递归处理数组项为对象的情况，为其添加依赖
 * 因为前面的递归阶段无法为数组中的对象元素添加依赖
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()// 表示是一个对象，读取的时候才会进行依赖收集
    if (Array.isArray(e)) {
      // 递归处理数组
      dependArray(e)
    }
  }
}
