/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 * 定义 arrayMethods 对象，用于增强 Array.prototype
 * 当访问 arrayMethods 对象上的那七个方法时会被拦截，以实现数组响应式
 */

import { def } from '../util/index'
// 备份 数组对象原型
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)// 以数组原型对象为模版，create继承方法

// 操作数组的七个方法，这七个方法可以改变数组自身
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 拦截变异方法并触发事件
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存原生方法
  const original = arrayProto[method]
  // def 就是 Object.defineProperty，拦截 arrayMethods.method 的访问
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)// 将original方法绑定在this上，赋值这个result并返回(apply是返回一个函数)
    const ob = this.__ob__
    let inserted
    // 我们知道，可以向数组内新增元素的方法有3个，分别是：push、unshift、splice
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 对新插入的元素做响应式处理
    if (inserted) ob.observeArray(inserted)
    // notify change通知更新
    ob.dep.notify()
    return result
  })
})
