/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * 一个组件一个 watcher（渲染 watcher）或者一个表达式一个 watcher（用户watcher）
 * 当数据更新时 watcher 会被触发，访问 this.computedProperty 时也会触发 watcher
 */
 */
export default class Watcher {
  // 参数的顺序可以不固定
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  // 执行构造函数
  constructor (
    vm: Component,
    expOrFn: string | Function,// this.getter是实例化watcher时传递的第二个参数，而getter在get里面执行
    // 函数和路径，一旦读取，就会触发数据的getter方法，
    // 而在getter方法中会将watcher实例添加到该数据的依赖列表中，当该数据发生变化时就会通知依赖列表中所有的依赖，依赖接收到通知后就会调用第四个参数回调函数去更新视图
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // 核心的一个逻辑parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn// getter 方法就是传入的第二个参数 updateComponent，其实也就是执行render(也就是读取数据，触发数据对象上面的 getter ) 和 update 方法
      // 所以首次渲染的过程 在 vm._render() 过程中，会触发所有数据的 getter，这样实际上已经完成了一个依赖收集的过程。
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 不是懒执行 就直接执行get方法
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 以下定义了一些原型方法，和依赖收集相关的有 get、addDep 和 cleanupDeps 方法
   */
  get () {
      /**
     * 执行 this.getter，并重新收集依赖（因为这里触发更新了）
     * this.getter 是实例化 watcher 时传递的第二个参数，一个函数或者字符串，比如：updateComponent 或者 parsePath 返回的函数
     * 为什么要重新收集依赖？
     *   因为触发更新说明有响应式数据被更新了，但是被更新的数据虽然已经经过 observe 观察了，但是却没有进行依赖收集，
     *   所以，在更新页面时，会重新执行一次 render 函数，执行期间会触发读取操作，这时候进行依赖收集
     */
    // 打开 Dep.target，Dep.target = this
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      //getter数据对应的之前的updateComponent函数
      value = this.getter.call(vm, vm)// 获取一下被依赖的数据,获取被依赖数据的目的是触发该数据上面的getter
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 触发他所有子项的getter
        traverse(value)
      }
      // 关闭 Dep.target，Dep.target = null
      popTarget()// 在get()方法最后将window.target释放掉
      this.cleanupDeps()
    }
    return value
  }

  /**
   *  /**
   * Add a dependency to this directive.
   * 两件事：
   *   1、添加 dep 给自己（watcher）
   *   2、添加自己（watcher）到 dep
   * this.deps 和 this.newDeps 表示 Watcher 实例持有的 Dep 实例的数组
   */
  addDep (dep: Dep) {
    // 判重，如果 dep 已经存在则不重复添加
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      // 缓存 dep.id，用于判重
      this.newDepIds.add(id)
      // 添加 dep，将dep放到watcher中 
      this.newDeps.push(dep)
      // 避免在 dep 中重复添加 watcher，this.depIds 的设置在 cleanupDeps 方法中
      if (!this.depIds.has(id)) {
        // 将watcher自己放dep中，双向收集
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 场景：v-if渲染的时候： Vue 设计了在每次添加完新的订阅，会移除掉旧的订阅
   * 依赖清空 在添加 deps 的订阅过程，已经能通过 id 去重避免重复订阅了
   * 所以 Watcher 在构造函数中会初始化 2 个 Dep 实例数组，newDeps 表示新添加的 Dep 实例数组，而 deps 表示上一次添加的 Dep 实例数组。
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
    // 懒执行时走这里，比如 computed
    // 将 dirty 置为 true，可以让 computedGetter 执行时重新计算 computed 回调函数的执行结果
      this.dirty = true
    } else if (this.sync) {
      // 同步执行，在使用 vm.$watch 或者 watch 选项时可以传一个 sync 选项，
    // 当为 true 时在数据更新时该 watcher 就不走异步更新队列，直接执行 this.run 
    // 方法进行更新
    // 这个属性在官方文档中没有出现
      this.run()
    } else {// 对于一般场景来说
      // 将当前watcher加入 watcher队列
      // 执行一个过滤的操作，同一个的 Watcher 在同一个 tick 的时候应该只被执行一次，将watcher对象自身传递给queuewatcher方法
      queueWatcher(this)// this 代表watcher实例自身
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {// 触发patch操作
    /**
 * 由 刷新队列函数 flushSchedulerQueue 调用，如果是同步 watch，则由 this.update 直接调用，完成如下几件事：
 *   1、执行实例化 watcher 传递的第二个参数，updateComponent 或者 获取 this.xx 的一个函数(parsePath 返回的函数)
 *   2、更新旧值为新值
 *   3、执行实例化 watcher 时传递的第三个参数，比如用户 watcher 的回调函数
 */
    if (this.active) {
      const value = this.get()// 执行get方法
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        // 更新新值为旧值
        this.value = value
        if (this.user) {// // 如果是用户 watcher，则执行用户传递的第三个参数 —— 回调函数，参数为 val 和 oldVal
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()// 会执行 value = this.getter.call(vm, vm)，这实际上就是执行了计算属性定义的 getter 函数
    this.dirty = false // 初始化时候为true，这里变成了false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
