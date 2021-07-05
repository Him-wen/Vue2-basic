import Dep from './dep';

class Observer {
    constructor(value) {
        this.value = value;
        if(Array.isArray(value)) {

        }
        this.walk(value);
    }
    walk( obj ) {
        const keys = Object.keys(obj);
        for(let i=0; i<keys.length; i++) {
            defineReactive(obj, keys[i]); // Keys[i]为每个键
        }
    }
}

function defineReactive(obj, key, val) {
    if(arguments.length === 2) {
        val = obj[key];
    }
    if(typeof val ==='object') {
        new Observer(val);
    }
    const dep = new Dep();
    Object.defineProperty(obj, val, {
        enumerable: true,
        configurable: true,
        get() {
            dep.addSub();// 收集依赖
            console.log('数据读取');
            return val;
        },
        set(newVal) {
            if(val === newVal) {
                return;
            }
            dep.notity();// 通知更新对应的Watcher的实例
            console.log('写入数据');
            return newVal;
        }
    })
}

let car =new Observer({
    name: 'james',
    'age':12,
})
car.name = 'jordan';
console.log(car);