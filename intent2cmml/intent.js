var MML = {};

( function()
{
    var mmlns = "http://www.w3.org/1998/Math/MathML";

    /**
     * Return true if a string is a valid XML name.
     * 
     * @param {String} name The string name.
     * @returns {Boolean} True if the string is a valid XML name.
     */
    var isXMLName = function( name )
    {
        return name && name.match( /^(?!xml)[A-Za-z]\w*$/i )
    };

    /**
     * Create a MathML error element.
     * 
     * @param {String} text The error message.
     * @returns {XML} The error element.
     */
    var createError = function( text )
    {
        var celt = document.createElementNS( mmlns, "merror" );
        text && celt.appendChild( document.createTextNode( text ) );
        return celt;
    };

    /**
     * Create a MathML token element.
     * 
     * @param {String} name The token element name.
     * @param {String} text The token element character data.
     * @returns {XML} The token element.
     */
    var createToken = function( name, text )
    {
        if ( !isXMLName( name ) )
        {
            return createError( "invalid element name:  " + name );
        }

        var celt = document.createElementNS( mmlns, name );
        text && celt.appendChild( document.createTextNode( text ) );
        return celt;
    };

    /**
     * Create a MathML apply element.
     * 
     * @param {XML} op The apply operator.
     * @returns {XML} The apply element.
     */
    var createApply = function( op )
    {
        var celt = document.createElementNS( mmlns, "apply" );
        op && celt.appendChild( op );
        return celt;
    };

    /**
     * Retrieve the value of a numeric reference.
     * 
     * @param {XML} pelt The ancestor element.
     * @param {String} name The reference name.
     * @returns {XML} The reference value.
     */
    var get_numeric_reference = function( pelt, name )
    {
        var args = pelt.mathArgs || collect_numeric_references( pelt );
        var value = args[ name ] || null;
        return value;
    };

    /**
     * Collect the numeric references within an element.
     * 
     * @param {XML} outer The outer presentation element.
     * @param {XML} inner The inner presentation element.
     * @returns {List} The list of numeric references.
     */
    var collect_numeric_references = function( outer, inner )
    {
        var args = ( outer.mathArgs = outer.mathArgs || [ null ] );
        inner = inner || outer;

        for ( var i = 0; i < inner.children.length; i += 1 )
        {
            var pelt = inner.children[ i ];

            if ( pelt.nodeName == "mo" )
            {
                continue;
            }

            var celt = MML.ptoc( pelt, outer );

            celt && args.push( pelt );
            celt || collect_numeric_references( outer, pelt );
        }

        return args;
    };

    /**
     * Process an intent attribute for a numeric reference.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_numeric_reference = function( pelt, intent )
    {
        var celt = null;

        var value = get_numeric_reference( pelt, intent.substring( 1 ) );
        if ( value )
        {
            celt = MML.ptoc( value, pelt );
        }
        else
        {
            celt = createError( "invalid reference:  " + intent );
        }

        return celt;
    };

    /**
     * Retrieve the value of a named reference.
     * 
     * @param {XML} pelt The ancestor element.
     * @param {String} name The reference name.
     * @returns {XML} The reference value.
     */
    var get_named_reference = function( pelt, name )
    {
        var names = pelt.mathNames || {};
        var values = names[ name ] || [];

        return values[ 1 ] ? false : values[ 0 ];
    };

    /**
     * Set the value of a named reference.
     * 
     * @param {XML} pelt The ancestor element.
     * @param {String} name The reference name.
     * @param {XML} value The reference value.
     */
    var set_named_reference = function( pelt, name, value )
    {
        var names = ( pelt.mathNames = pelt.mathNames || {} );
        var values = ( names[ name ] = names[ name ] || [] );

        values.push( value );
    };

    /**
     * Collect the named references within an element.
     * 
     * @param {XML} pelt The presentation element.
     */
    var collect_named_references = function( pelt )
    {
        var name = pelt.getAttribute( "arg" );
        if ( !( name && name.match( "[A-Za-z_][A-Za-z0-9_.]*" ) ) )
        {
            name = null;
        }

        var outer = name ? pelt : null;
        while ( outer && outer.namespaceURI == mmlns )
        {
            var att = outer.getAttribute( "intent" );
            if ( att && att.match( "\\$" + name + "([(,)@]|$)" ) )
            {
                set_named_reference( outer, name, pelt );
                break;
            }

            outer = outer.parentElement;
        }

        for ( var i = 0; i < pelt.children.length; i += 1 )
        {
            collect_named_references( pelt.children[ i ] );
        }
    };

    /**
     * Process an intent attribute for a named reference.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_named_reference = function( pelt, intent )
    {
        var celt = null;

        var value = get_named_reference( pelt, intent.substring( 1 ) );
        if ( value )
        {
            celt = MML.ptoc( value, pelt );
        }
        else if ( value == false )
        {
            celt = createError( "duplicate reference:  " + intent );
        }
        else
        {
            celt = createError( "invalid reference:  " + intent );
        }

        return celt;
    };

    /**
     * Process the child elements.
     * 
     * @param {XML} pelt The presentation element.
     */
    var process_children = function( pelt )
    {
        for ( var i = 0; i < pelt.children.length; i += 1 )
        {
            MML.ptoc( pelt.children[ i ], pelt );
        }
    };

    /**
     * Collect the child elements.
     * 
     * @param {XML} pelt The presentation element.
     * @param {XML} celt The content element.
     */
    var collect_children = function( pelt, celt )
    {
        if ( celt && celt.nodeName == "merror" )
        {
            celt = null;
        }

        for ( var i = 0; i < pelt.children.length; i += 1 )
        {
            var elt = pelt.children[ i ].mathContent;
            celt && elt && celt.appendChild( elt );
        }
    };

    /**
     * Retrieve the main operator if there is only one.
     * 
     * @param {XML} pelt The presentation element.
     * @returns {XML} The content operator.
     */
    var get_operator = function( pelt )
    {
        var name = null;
        var celt = null;

        for ( var i = 0; i < pelt.children.length; i += 1 )
        {
            var elt = pelt.children[ i ];
            if ( elt.nodeName == "mo" && elt.mathContent )
            {
                if ( name == null )
                {
                    name = elt.textContent;
                    celt = elt.mathContent;
                }
                else if ( name != elt.textContent )
                {
                    return null;
                }
            }
        }

        return celt;
    };

    /**
     * Share the content operator.
     * 
     * @param {XML} pelt The presentation element.
     * @param {XML} celt The content operator.
     */
    var share_operator = function( pelt, celt )
    {
        for ( var i = 0; i < pelt.children.length; i += 1 )
        {
            var elt = pelt.children[ i ];
            if ( elt.nodeName == "mo" && elt.mathContent && celt )
            {
                elt.mathContent = celt;
            }
        }
    };

    /**
     * Parse the intent to extract the functional arguments.
     * 
     * @param {String} intent The intent attribute.
     * @returns {Array} The functional arguments.
     */
    var get_arguments = function( intent )
    {
        var args = [];

        var start = 0;
        var depth = 0;
        for ( var i = 0; i < intent.length; i += 1 )
        {
            if ( depth == 0 && args[ 0 ] )
            {
                return createError( "mismatched parentheses:  " + intent );
            }

            var ch = intent.charAt( i );
            if ( ch == '(' )
            {
                depth += 1;
            }
            if ( ch.match( /[(,)]/ ) && depth == 1 && i > start )
            {
                args.push( intent.substring( start, i ).trim() );
                start = i + 1;
            }
            if ( ch == ')' )
            {
                depth -= 1;
            }

            if ( depth < 0 )
            {
                return createError( "mismatched close parenthesis:  " + intent );
            }
        }

        if ( depth > 0 )
        {
            return createError( "mismatched open parenthesis:  " + intent );
        }

        return args;
    };

    /**
     * Process an intent attribute for a row.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_row = function( pelt, intent )
    {
        process_children( pelt );

        var op = get_operator( pelt );
        share_operator( pelt, op );

        var celt = createApply();
        collect_children( pelt, celt );

        if ( intent )
        {
            op && celt.removeChild( op );

            intent = intent.replace( "@", "" );
            op = process_function( pelt, intent );
        }

        op && celt.prepend( op );

        return celt;
    };

    /**
     * Process an intent attribute in functional form.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_apply = function( pelt, intent )
    {
        var args = get_arguments( intent );
        if ( !args.length )
        {
            return args;
        }

        var celt = createApply();
        for ( var i = 1; i < args.length; i += 1 )
        {
            var arg = process_intent( pelt, args[ i ] );
            arg && celt.appendChild( arg );
        }

        var op = process_function( pelt, args[ 0 ] );
        op && celt.prepend( op );

        return celt;
    };

    /**
     * Process an intent attribute for an operator.
     * 
     * @param {XML} pelt The presentation element.
     * @returns {XML} The content element.
     */
    var process_operator = function( pelt )
    {
        var celt = null;

        var op = MML.op_table[ pelt.textContent ];
        if ( op )
        {
            celt = createToken( op );
        }
        else if ( isXMLName( pelt.textContent ) )
        {
            celt = createToken( pelt.textContent );
        }

        return celt;
    };

    /**
     * Process an intent attribute for a token.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_token = function( pelt, intent )
    {
        var celt = null;

        var id = MML.id_table[ pelt.textContent ];
        if ( id )
        {
            celt = createToken( id );
        }
        else
        {
            celt = createToken( intent.substring( 1 ), pelt.textContent );
        }

        return celt;
    };

    /**
     * Process the intent attribute for a function value.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_function = function( pelt, intent )
    {
        var celt = null;

        // Numeric intent (literal)
        if ( intent.match( /^#?[0-9.][A-Za-z0-9_.]*$/ ) )
        {
            celt = createToken( "cn", intent.replace( "#", "" ) );
        }

        // Identifier intent (literal)
        else if ( intent.startsWith( "#" ) )
        {
            celt = createToken( "ci", intent.substring( 1 ) )
        }

        // Argument reference (number)
        else if ( intent.match( /^\$[0-9]+$/ ) )
        {
            celt = process_numeric_reference( pelt, intent );
        }

        // Argument reference (name)
        else if ( intent.startsWith( "$" ) )
        {
            celt = process_named_reference( pelt, intent );
        }

        // Named intent (literal)
        else
        {
            celt = createToken( intent );
        }

        return celt;
    };

    /**
     * Process the intent attribute.
     * 
     * @param {XML} pelt The presentation element.
     * @param {String} intent The intent attribute.
     * @returns {XML} The content element.
     */
    var process_intent = function( pelt, intent )
    {
        var celt = null;

        // Functional intent (apply)
        if ( intent.match( /^.*[\(\)].*$/ ) )
        {
            celt = process_apply( pelt, intent );
        }

        // Sequence intent (mrow)
        else if ( intent == "@" )
        {
            celt = process_row( pelt );
        }

        // Apply intent (mfrac)
        else if ( intent.startsWith( "@" ) )
        {
            celt = process_row( pelt, intent );
        }

        // Apply intent (apply)
        else if ( intent.endsWith( "@" ) )
        {
            celt = process_row( pelt, intent );
        }

        // Operator intent (mo)
        else if ( intent == "!" )
        {
            celt = process_operator( pelt );
        }

        // Token intent (mi mn)
        else if ( intent.startsWith( "!" ) )
        {
            celt = process_token( pelt, intent );
        }

        // Empty intent (mphantom)
        else if ( intent == "/" )
        {
            celt = null;
        }

        // Container intent (math)
        else if ( intent.startsWith( "/" ) )
        {
            celt = createToken( intent.substring( 1 ) );
            process_children( pelt );
            collect_children( pelt, celt );
        }

        // Function name forms
        else
        {
            celt = process_function( pelt, intent );
        }

        return celt;
    };

    /**
     * Process a presentation element.
     * 
     * @param {XML} pelt The presentation element.
     * @param {XML} parent The parent element, if any.
     * @returns {XML} The content element.
     */
    MML.ptoc = function( pelt, parent )
    {
        if ( !( pelt && pelt.nodeType == Node.ELEMENT_NODE ) )
        {
            return null;
        }

        if ( pelt.mathContent )
        {
            return pelt.mathContent;
        }

        var celt = null;
        var name = pelt.nodeName;
        var intent = pelt.getAttribute( "intent" ) || MML.elt_table[ name ];

        if ( intent )
        {
            parent || collect_named_references( pelt );
            celt = process_intent( pelt, intent );
        }

        if ( celt )
        {
            pelt.mathContent = celt;
            celt.mathPresent = pelt;
        }

        return celt;
    };
} )();

/**
 * MathML configuration data.
 */

/**
 * The table of content element names for presentation identifiers.
 */
MML.id_table = {
    "\u0391" : "Alpha",
    "\u03A9" : "Omega",
    "\u03B1" : "alpha",
    "\u03C9" : "omega",
};

/**
 * The table of content element names for presentation operators.
 */
MML.op_table = {
    "=" : "eq",
    "+" : "plus",
    "-" : "minus",
    "!" : "factorial",
    "\u00B1" : "pm",
    "\u2062" : "times",
    "\u222B" : "integral",
};

/**
 * The table of default intent values for presentation elements.
 */
MML.elt_table = {

    "math" : "/math",

    "mi" : "!ci",
    "mn" : "!cn",
    "mo" : "!",
    // "mtext" : null,
    // "mspace" : null,
    // "ms" : null,

    "mrow" : "@",
    "mfrac" : "@divide",
    "msqrt" : "@root",
    "mroot" : "@root",
    "mstyle" : "@",
    "merror" : "@",
    "mpadded" : "@",
    // "mphantom" : null,
    // "mfenced" : null,
    // "menclose" : null,

    // "msub" : null,
    "msup" : "@power",
    // "msubsup" : null,
    // "munder" : null,
    // "mover" : null,
    // "munderover" : null,
    // "mmultiscripts" : null,

    // "mtable" : null,
    // "mlabeledtr" : null,
    // "mtr" : null,
    "mtd" : "@",
    // "maligngroup" : null,
    // "malignmark" : null,

    // "mstack" : null,
    // "mlongdiv" : null,
    // "msgroup" : null,
    // "msrow" : null,
    // "mscarries" : null,
    // "mscarry" : null,
    // "msline" : null,

    // "maction" : null,
};
