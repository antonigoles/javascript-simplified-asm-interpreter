
<h1> <img align="center"  width=50 src="https://cdn.hackr.io/uploads/topics/1507565940Mt96nRTIF8.png"> 
<b>Simplified ASM interpreter</b> </h1> 


- enchmarking my JS skills


### Usage
---
```js

const interpeter = require('./interpreter.js')

const code = `
mov  a, 5
inc  a
call function
msg  '(5+1)/2 = ', a    ; output message
end

function:
    div  a, 2
    ret
`

console.log( interpeter(code) )
// OUTPUT: (5+1)/2 = 3

```