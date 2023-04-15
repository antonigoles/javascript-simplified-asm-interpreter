DEBUG_MODE = false


function lastElement( dataContainer ) { return dataContainer[ dataContainer.length - 1 ] }

class Stack {
    constructor() { this.elements = [] }
    push(element) { this.elements.push(element) }
    pop() { return this.elements.pop(); }
    top() { return lastElement( this.elements ) }
}

function assemblerInterpreter(program) {
    let parsed_text = parser(program)
    let tokens = tokenizer(parsed_text)
    // let syntaxTree = syntaxTreeGenerator(tokens)
    const context = generateContext(tokens);
    debug(parsed_text)
    debug(tokens)
    debug(JSON.stringify(context, null, 2))

    return interpeter( context )
}
  
  
function parser(code) {
    // split into lines;
    code = code.split("\n").map( e => e.trim() )

    // ignore comments
    code = code.map( line => {    
        let newLine = "";
        let inBrackets=false;
        for ( let i = 0; i<line.length; i++ ) {
            if ( line[i] == '\'' ) inBrackets = !inBrackets;
            if ( line[i] == ';' && !inBrackets ) break;
            newLine += line[i];
        }
        return newLine;
    })

    return code
}

function tokenizer( parsed_text ) {
    const tokens = parsed_text.map( line => {
        let lineTokens = []
        let currentToken = ""
        let inBrackets = false;
        for ( let i = 0; i<line.length; i++ ) {
            // Potential BUG: what about this char -> \' 
            if ( line[i] == '\'' ) inBrackets = !inBrackets;
            if ( line[i] == ',' && !inBrackets ) {
                lineTokens.push(currentToken);
                // lineTokens.push(line[i]);
                currentToken = "";
                continue;
            }
            if ( line[i] == ' ' && !inBrackets ) {
                if ( currentToken == "" ) continue;
                lineTokens.push( currentToken ); 
                currentToken = "";
                continue;
            };
            currentToken += line[i];
        }
        if ( currentToken.length > 0 ) lineTokens.push(currentToken)
        return lineTokens;
    })

    return tokens
}

// @legacy
function syntaxTreeGenerator( tokens, offset=0, label="@global" ) {
    const tree = { 
        context: label, 
        operations: [],
        labels: {},  
    }

    function generateForNextLine( tokens, pointer, tree ) {
        let token = tokens[pointer];
        if ( token.length == 0 ) return generateForNextLine( tokens, pointer+1, tree );
        if ( token[0] == 'end' ) {
            tree['operations'].push({ type: 'end' })
            return generateForNextLine( tokens, pointer+1, tree );
        }
        if ( token[0] == 'ret' ) {
            // finish line
            tree['operations'].push({ type: 'ret' })
            return pointer;
        } else if ( token.length == 1 && lastElement(token[0]) == ":" ) {
            // a label found
            const labelName = token[0].slice(0,-1);
            debug("Parsing procedure:", labelName)
            const subTreeGenerationResult = syntaxTreeGenerator( tokens, pointer+1, labelName );
            tree['labels'][labelName] = subTreeGenerationResult[0];
            pointer = subTreeGenerationResult[1];
        } else {
            tree['operations'].push({ 
                type: 'operation', 
                operation: token[0], 
                operands: token.slice(1)
            })
        }
        if ( pointer+1 < tokens.length ) return generateForNextLine( tokens, pointer+1, tree )
        return pointer;
    }

    offset = generateForNextLine(tokens, offset, tree);
    return [tree, offset];
}

function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function isString(str) {
    return str[0] == '\''
}

function generateContext( tokens ) {
    const context = {
        operations: [],
        labels: {

        }
    }

    let ptr=0;
    for ( let i = 0; i<tokens.length; i++ ) {
        let token = tokens[i];
        if ( token.length == 0 ) continue;
        if ( token.length == 1 && lastElement(token[0]) == ":" ) {
            // a label found
            const labelName = token[0].slice(0,-1);
            context['labels'][labelName] = { pointer: ptr };
            // ptr++;
        } else {
            context['operations'].push({ 
                pointer: ptr,
                type: 'operation', 
                operation: token[0], 
                operands: token.slice(1).map(
                    operand => {
                        return isNumeric(operand) ? 
                        {
                            type: 'value',
                            value: Number(operand)
                        } 
                        : 
                        isString(operand) ? 
                        {
                            type: 'value',
                            value: operand.slice(1,-1)
                        }
                        :
                        {
                            type: 'reference',
                            value: operand
                        }
                    }
                )
            })
            ptr++;
        }
    }

    return context
}


const performOperation = ( context, ptr, memory, retPointerPositions, onMessage ) => {
    const operation = context['operations'][ptr];

    const jmpToLabel = (label) => {
        return context['labels'][ label ]['pointer']
    }

    const getValueFromParam = (arg) => {
        return arg.type == 'value' ? arg.value : memory[arg.value];
    }

    const operationDefinitions = {
        "mov": (args) => {
            const val = getValueFromParam(args[1]);
            memory[ args[0].value ] = val;
            return ptr+1
        },
        "inc": (args) => {
            memory[ args[0].value ]++;
            return ptr+1
        },
        "dec": (args) => {
            memory[ args[0].value ]--;
            return ptr+1
        },
        "add": (args) => {
            const val = getValueFromParam(args[1]);
            memory[ args[0].value ] += val;
            return ptr+1
        },
        "sub": (args) => {
            const val = getValueFromParam(args[1]);
            memory[ args[0].value ] -= val;
            return ptr+1
        },
        "mul": (args) => {
            const val = getValueFromParam(args[1]);
            memory[ args[0].value ] *= val;
            return ptr+1
        },
        "div": (args) => {
            const val = getValueFromParam(args[1]);
            memory[ args[0].value ] = Math.floor(memory[ args[0].value ] / val);
            return ptr+1
        },

        "jmp": (args) => {
            return jmpToLabel( args[0].value )
        },

        "cmp": (args) => {
            const [ left, right ] = [ getValueFromParam(args[0]), getValueFromParam(args[1]) ]
            memory["@LAST_COMPERATOR"] = { left, right };
            return ptr+1
        },
        "jne": (args) => {
            const { left, right } = memory["@LAST_COMPERATOR"];
            if ( left != right ) return jmpToLabel( args[0].value ) 
            return ptr+1
        },
        "je": (args) => {
            const { left, right } = memory["@LAST_COMPERATOR"];
            if ( left == right ) return jmpToLabel( args[0].value ) 
            return ptr+1
        },
        "jge": (args) => {
            const { left, right } = memory["@LAST_COMPERATOR"];
            if ( left >= right ) return jmpToLabel( args[0].value ) 
            return ptr+1
        },
        "jg": (args) => {
            const { left, right } = memory["@LAST_COMPERATOR"];
            if ( left > right ) return jmpToLabel( args[0].value ) 
            return ptr+1
        },
        "jle": (args) => {
            const { left, right } = memory["@LAST_COMPERATOR"];
            if ( left <= right ) return jmpToLabel( args[0].value ) 
            return ptr+1
        },
        "jl": (args) => {
            const { left, right } = memory["@LAST_COMPERATOR"];
            if ( left < right ) return jmpToLabel( args[0].value ) 
            return ptr+1
        },

        "call": (args) => {
            retPointerPositions.push(ptr+1)
            return jmpToLabel(args[0].value)
        },

        "msg": (args) => {
            onMessage(args)
            return ptr+1
        },

        'ret': (args) => {
            return retPointerPositions.pop();
        },

        'end': (args) => {
            return -1
        },
    }

    return operationDefinitions[operation.operation](operation.operands)
}

function interpeter( context, memory={} ) {
    let ptr = 0;
    let hasReachedTheEnd = false;
    const retPointerPositions = new Stack();
    let output = -1;

    const onMessage = (args) => {
        if ( output == -1 ) output = "";
        output += args.map( arg => arg.type == 'value' ? arg.value : memory[arg.value] ).join("");
    }

    debug(ptr)
    while ( !hasReachedTheEnd ) {
        debug("Pointer:")
        debug(ptr)
        ptr = performOperation( context, ptr, memory, retPointerPositions, onMessage );
        debug(memory)
        if ( ptr >= context.operations.length ) {
            hasReachedTheEnd=true;
            output=-1;
        }
        if ( ptr == -1 ) hasReachedTheEnd = true;
    }

    return output
}

function debug(text) { if (DEBUG_MODE) console.log(text) }



module.exports = assemblerInterpreter;