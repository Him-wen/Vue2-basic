/* @flow */

import { toArray } from '../util/index'
/**
 * 定义 Vue.use，负责为 Vue 安装插件，做了以下两件事：
 *   1、判断插件是否已经被安装，如果安装则直接结束
 *   2、安装插件，执行插件的 install 方法
 * @param {*} plugin install 方法 或者 包含 install 方法的对象
 * @returns Vue 实例
 */
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    
    // 已经安装过的插件列表
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this// 如果已经安装了，就直接返回函数
    }

    // additional parameters 将 Vue 实例放到第一个参数位置，然后将这些参数传递给 install 方法
    const args = toArray(arguments, 1)
    args.unshift(this)

    // plugin 是一个对象，则执行其 install 方法安装插件
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
      // 执行直接 plugin 方法安装插件
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 在 插件列表中 添加新安装的插件
    installedPlugins.push(plugin)
    return this
  }
}
