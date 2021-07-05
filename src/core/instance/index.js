import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue 构造函数
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 调用 Vue.prototype._init 方法，该方法是在 initMixin 中定义的
  this._init(options)
}

// 定义 Vue.prototype._init 方法
initMixin(Vue)
// $data $props $set $ delete $watch
stateMixin(Vue)
// $on $emit $once $off
eventsMixin(Vue)
// _update $forceUpdate $ destroy
lifecycleMixin(Vue)
// 渲染 $nexttick _render
renderMixßin(Vue)

export default Vue
