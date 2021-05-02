nexttick大概的工作流程

数据变更
=> setter
=> dep.notify() 
=> watcher.update() 
=> queueWatcher(this) // watcher把自身传进了queueWatcher()
在queueWatcher方法中
=> queue.push(watcher) // 在push之前会检查queue中是否已有该watcher
=> !waiting 同时将 waiting 置为 true && nextTick(() => {
	// ... 执行queue中所有watcher的run
 再将waiting 置为 false 以执行下一轮循环
	})

几个标志位的理解：
schedulerQueue：待更新的watcher队列，id唯一
waiting：已经向回调任务队列中添加flushSchedulerQueue方法了，这个方法将会触发所有watcher的更新工作
pending：已经提交了一个异步task，即将或者正在执行回调任务队列中的所有任务（只能有一个异步任务）
false：表示执行不等待（执行）的状态
true：表示 等待挂起的状态

每个Vue实例生成一个Watcher实例，data里面的每个属性有一个Dep实例，一个Dep实例的subs属性里面存储这个data属性被引用的Vue实例中的Watcher实例，当这个data属性每次调用setter方法被修改后，每个Watcher实例都会调用update方法，但是只有此轮所有update执行完后，每个Watcher实例才会调用run方法，Vue实例才会修改视图！

pending 的存在保证连续多次调用 nextTick 的时候只调用一次（promise）setTimeout(flushCallbacks, 0)，setTimeout属于异步，所以flushCallbacks 将会在所有 nextTick 的 cb 收集完成后执行。

到底是一个data里的某属性a会对应一个watcher实例还是整个vm实例会对应一个watcher实例？
每个data里面的属性都会创建一个Watcher
data 的每一个属性都会有个 dep，dep 上有个 subs 属性，值为 watcher 组成的数组。如多 data.a 来说，在视图中多个地方被使用，就会生成多个 watcher，保存在 subs 中。

举个例子：
分清dep和watcher在data的区别
let data={
    a = b,
    b,
}
data.a使用了 b 赋值 即 a 使用（依赖）了 b 这个数据，就给 b 建一个依赖数组（b），然后把 a 放入 b的依赖数组,同时 a 的值就是一个watcher，保存在依赖数组subs中，然后 a 也有个dep依赖数组，属于多对多关系

关于对应关系
一个组件有一个 watcher负责一个组件的更新，组件里面用到的响应式数据上的属性（b）都有个 dep，dep 收集组件级别的 watcher(a 使用 b) 等到 b 更新时候 就通知 a 的 watcher 去更新 这个组件的视图（一个属性 a 变了，那依赖的整个组件都更新，所以就有 patch 找哪里去更新）

每个组件的data属性上有一个 dep 依赖数组 收集各个组件的 watcher

属性只有 dep 没有 watcher

watcher对应三种：一种组件的渲染 一种computed 一种watcher watch属性里面

data.a对应一个dep,data.b对应一个dep


Vue 的异步更新机制的核心是利用了浏览器的异步任务队列来实现的，首选微任务队列，宏任务队列次之。
当响应式数据更新后，会调用 dep.notify 方法，通知 dep 中收集的 watcher 去执行 update 方法，watcher.update 将 watcher 自己放入一个 watcher 队列（全局的 queue 数组）。
然后通过 nextTick 方法将一个刷新 watcher 队列的方法（flushSchedulerQueue）放入一个全局的 callbacks 数组中。

重点来了：先是 A轮 收集一轮队列，然后执行下面的timerFunc，在进行第二轮的收集

如果此时浏览器的异步任务队列中没有一个叫 flushCallbacks 的函数，则执行 timerFunc 函数，将 flushCallbacks 函数放入异步任务队列。如果异步任务队列中已经存在 flushCallbacks 函数，等待其执行完成以后再放入下一个 flushCallbacks 函数。
flushCallbacks 函数负责执行 callbacks 数组中的所有 flushSchedulerQueue 函数。
flushSchedulerQueue 函数负责刷新 watcher 队列，即执行 queue 数组中每一个 watcher 的 run 方法，从而进入更新阶段，比如执行组件更新函数或者执行用户 watch 的回调函数。
完整的执行过程其实就是今天源码阅读的过程。