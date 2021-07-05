this.$options.data
this.$data
this._data
this.data

this 一般就是 vm 实例

# initdata方法
直接赋值：vm._data = vm.$options.data
3. vm._data.key = vm.key 相当于将 _data 省略

# stateMixin方法对于 data 的处理
$data 属于原型上面的方法，vm 继承原型上面的方法
将 Vue.prototype.$data 原型方法上代理 this._data，然后vm实例上面的有 vm.$data 访问

结论 = Vue.prototype.$data = vm.$data = this._data = data = $options.data

底层：initdata 将 vm._data.xxx 通过proxy的代理变成 **vm._data.key**，再通过 defineproperty 变成**vm.key** = vm._data.key

网上有一份链接：https://blog.csdn.net/weixin_41845146/article/details/85257924