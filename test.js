const fs = require('fs');
const interpeter = require('./interpreter.js')

console.log(
"-----------------------------\n" +
"  ASM INTERPRETATION OUTPUT  \n" +
"-----------------------------"
)

for ( const file of fs.readdirSync('./tests') ) {
    const skipTests = []//[ 'a','b','c','e','f','g', ]
    if ( skipTests.includes( file[0] ) ) continue;
    const fileData = fs.readFileSync( `./tests/${file}`, {encoding:'utf8', flag:'r'} )
    console.log(`\n-----------------------------\n- ${file} output:`)
    console.log( interpeter(fileData) )
}
