/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
let pending = false

/**
 * 做了三件事：
 *   1、将 pending 置为 false
 *   2、清空 callbacks 数组
 *   3、执行 callbacks 数组中的每一个函数（flushSchedulerQueue）
 */
function flushCallbacks () { // 在浏览器空闲的时候 执行这个任务 任务队列在task中创建一个事件，执行时将callbacks中的cb回调函数全部执行，只会有一个函数
  pending = false // 将pengding置为false 再接着nexttick里面的逻辑
  const copies = callbacks.slice(0)// 相当于备份一个，以便于下面执行
  callbacks.length = 0// 清空 数组
  for (let i = 0; i < copies.length; i++) {// 在执行时将callbacks中的所有cb（flushSchedulerQueue）依次执行
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line 优先使用这函数 */ 
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)// 在执行时将callbacks中的所有cb（flushSchedulerQueue）依次执行

    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    try {
      return fn.apply(null, arguments)
    } finally {
      useMacroTask = false    
    }
  })
}

/**
 * 完成两件事：
 *   1、用 try catch 包装 flushSchedulerQueue 函数，然后将其放入 callbacks 数组
 *   2、如果 pending 为 false，表示现在浏览器的任务队列中没有 flushCallbacks 函数
 *     如果 pending 为 true，则表示浏览器的任务队列中已经被放入了 flushCallbacks 函数，
 *     待执行 flushCallbacks 函数时，pending 会被再次置为 false，表示下一个 flushCallbacks 函数可以进入
 *     浏览器的任务队列了
 * pending 的作用：保证在同一时刻，浏览器的任务队列中只有一个 flushCallbacks 函数
 * @param {*} cb 接收一个回调函数 => flushSchedulerQueue
 * @param {*} ctx 上下文
 * @returns 
 * 需要拿到修改的数据的DOM，可以手动将需要的DOM操作放到nexttick里面的函数 延迟 执行 就可以操作修改后的元素DOM
 */
export function nextTick (cb?: Function, ctx?: Object) {// 回调函数，上下文
  let _resolve
  callbacks.push(() => {// 将包装后的 回调函数 数组放到callbacks数组中
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {// 用户自己调用的时候，出错的时候捕获
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {// pending为fasle，表示异步队列没有这个叫flushCallbacks的函数，
    //下面微任务或者红任务就执行 在浏览器的任务队列中（首选微任务队列）放入 flushCallbacks 函数
    // 优先使用promise微任务
    pending = true
    if (useMacroTask) {// 初始化就是置false
      macroTimerFunc()
    } else {
      microTimerFunc()// 优先使用微任务 防止多次调用：在pengding为fasle的时候执行：pending为true的话，表示已经提交了task，即将或者正在执行回调任务队列中的所有任务
    }
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
