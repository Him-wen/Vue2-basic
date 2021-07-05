

/**
 * 每个数据属性都有一个Dep类的实例，谁（watcher实例）使用到了这个数据 就将 谁 添加进来 
 */
export default class Dep {
    constructor() {
        this.subs = [];
    }

    addSub(sub) {
        this.subs.push(sub);
    }

    removeSub(sub) {
        remove(this.subs, sub);
    }

    depend() {
        if(window.target) {
            this.addSub(window.target);
        }
    }

    notity() {
        for(let i=0; i<this.subs.length; i++) {
            subs[i].update();// 待实现
        }
    }
}

function remove(arr, item) {// 删除
    if(arr.length) {
        const index = arr.indexOf(item);
        if(index > -1) {
            return arr.splice(index, 1);
        }
    }
}