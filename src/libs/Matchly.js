/**
 * @license Copyright 2020 - Chris West - MIT Licensed
 * Matchly attempts to give you the power of advanced search engine
 * expressions for datasets in JavaScript.
 */
 var Matchly = (function() {
  var ALLOWED_BEFORE = {
    OPEN: ['OPEN', 'TERM', 'FIELD'],
    TERM: ['TERM', 'OP', 'CLOSE', 'FIELD'],
    CLOSE: ['OP', 'CLOSE'],
    OP: ['TERM', 'OPEN', 'FIELD'],
    FIELD: ['TERM', 'OPEN']
  };
  var OP_NAME_TO_BIT = {
    AND: '&',
    OR: '|',
    XOR: '^'
  };
  var OP_NAME_TO_LOGIC = {
    AND: '&&',
    OR: '||',
    XOR: '!=='
  };

  /**
   * Creates a object which can be used to match strings against an expression
   * similar to those that can be used on search engines.
   * @param searchExpression {string}
   *   A search expression that can contain parentheses, the AND operator, the OR
   *   operator, the XOR operator, regular expressions, quoted strings and words
   *   which can also be modified by the + or - signs.
   */
  function Pattern(searchExpression, options) {
    options = Object(options); // Coerce to an object

    // Expression will be used to test against objects instead of strings.
    var fields = options.fields;


    // Parse the different parts of the search expression:
    // - OPEN (normal open paren or negated open paren)
    // - CLOSE (close paren)
    // - TERM (RegExp, quoted text, word)
    // - OP (operator)
    // - FIELD (field name)
    var parts = [];
    searchExpression.replace(
      /(NOT\x28)|(\x28)|(\x29)|\s+(AND|X?OR)\s+|(\w+(?:-\w+)*):|\[([^\[\]]*)\]:|([\+\-])?(?:"([^"]+)"|\/((?:[^\\\/]+|\\.)+)\/(\w*)|([^\x28\x29\s]+))/g,
      function(match, negOpenParen, openParen, closeParen, operator, field, bracketField, plusMinus, quote, rgxBody, rgxFlags, word, index) {
        var type = ((negOpenParen || openParen) && "OPEN")
          || (closeParen && "CLOSE")
          || (operator && "OP")
          || ((field || bracketField) && "FIELD")
          || ((quote || rgxBody || word) && "TERM");
        var value = operator
          || field
          || bracketField
          || ((type === 'TERM') && [
            rgxBody || ('\\b' + (quote || word).replace(
              /[[\](){}.+^$|\\?-]|(\*\S*)/g,
              function(m, star) {
                return star
                  ? star.length > 1
                    ? '\\S*?' + star.slice(1) + '(?=\\s|$)'
                    : '.*?'
                  : '\\' + m;
              }
            )),
            rgxBody ? rgxFlags : ((options.firstOnly ? '' : 'g') + (options.mindCase ? '' : 'i'))
          ])
          || match;
        parts.push({
          type: type,
          index: index,
          value: value,
          match: match,
          plusMinus: plusMinus
        });
      }
    );

    var signedTerms; // Grouping of consecutive terms starting with + or -
    var plainTerms; // Group of consecutive terms NOT starting with + or -
    var bitExpr = ''; // Search expression as Bitwise expression
    var logicExpr = '';
    var lastType = 'OPEN'; // Last part type
    var openCount = 0; // Count of open parens
    var termParts = []; // Only the term parts
    // Paren grouping info (reverse order)
    var parenLevels = [{negate:false, group:0, fields: fields}];
    var groupCount = 0; // Grouping count (parens and consecutive term groups)
    var unusedField; // Define a field for a term or a paren group

    // Convert search expression into a bitwise expression.
    parts.forEach(function(part, partIndex) {
      var allowedTypes = ALLOWED_BEFORE[lastType];
      var partType = part.type;

      // If this type is not supposed to come next throw an error.
      if(allowedTypes.indexOf(partType) < 0) {
        throw new Error('Unexpected ' + partType + ' at position ' + (part.index + 1) + '.  Should have supplied one of the following:  ' + allowedTypes);
      }

      // If a term was encountered...
      if (lastType !== 'TERM' && lastType !== 'FIELD') {
        signedTerms = [];
        plainTerms = [];
        groupCount++;
      }
      if (partType === 'TERM') {
        // Term variable name
        part.name = 't' + termParts.push(part);
        // All paren groups that the term part falls under.  Used later to assist
        // in filtering out invalid XOR results when using exec().
        part.groups = [groupCount].concat(parenLevels.slice(0, -1).map(function(paren){return paren.group}));
        // Keep track of the fields to check.
        part.fields = unusedField === undefined ? parenLevels[0].fields : [unusedField];
        // Clear out the unusedField value
        unusedField = undefined;
        
        // Place the term variable name in the correct bucket along with any
        // necessary bitwise modifiers.
        if (part.plusMinus || options.definiteTerms) {
          signedTerms.push((part.plusMinus === '-' ? '+!' : '') + part.name);
        }
        else {
          plainTerms.push(part.name);
        }

        // Used later to build exec() correctly so as to not return negated
        // matches.
        part.negate = parenLevels[0].negate !== (part.plusMinus === '-');

        // If this is the last term in the series of terms...
        if (['FIELD', 'TERM'].indexOf((parts[partIndex + 1] || {}).type)<0) {
          // "g" variable added to later be used to correctly filter out
          // unnecessary XOR results.
          bitExpr += '(g' + groupCount + '=' + signedTerms.concat(['(' + plainTerms.concat([+!!signedTerms.length]).join('|') + ')']).join('&') + ')';
          logicExpr += '(' + (
            signedTerms.length
              ? (plainTerms.length ? signedTerms.concat(['(' + plainTerms.join(' || ') + ')']) : signedTerms).join(' && ')
              : plainTerms.join(' || ')
          ).replace(/\+!/g, '') + ')';
        }
      }
      // If an open paren was encountered (can be a negated open paren)...
      else if (partType === 'OPEN') {
        var isNot = part.value === 'NOT(';
        openCount++;
        groupCount++;
        // "g" variable added to later be used to correctly filter out unnecessary
        // XOR results.
        bitExpr += '(g' + groupCount + '=' + (isNot ? '+!(' : '(');
        logicExpr += isNot ? '!(' : '(';
        // Load parenLevels from the front.
        parenLevels.unshift({
          negate: parenLevels[0].negate !== isNot,
          group: groupCount,
          fields: unusedField === undefined ? parenLevels[0].fields : [unusedField]
        });
        // Clear out the unused field value
        unusedField = undefined;
      }
      // If a closing paren was encountered...
      else if (partType === 'CLOSE') {
        // If the number of open parens is not 0...
        if (openCount) {
          openCount--;
          parenLevels.shift();
          // Doubled because opening is doubled so that "g" variable can be defined.
          bitExpr += '))';
          logicExpr += ')';
        }
        // If the number of open parens is 0 throw an error.
        else {
          throw new Error('Prematurely ended expression at position ' + (part.index + 1) + '.');
        }
      }
      else if (partType === 'FIELD') {
        unusedField = part.value;
      }
      // Must be an operator so add the appropriate bitwise operator.
      else {
        bitExpr += OP_NAME_TO_BIT[part.value];
        logicExpr += ' ' + OP_NAME_TO_LOGIC[part.value] + ' ';
      }

      // Keep this part's type for the next iteration.
      lastType = partType;
    });

    // Make sure that some terms were actually found in the expression.
    if (!termParts.length) {
      throw new Error('No terms were specified.');
    }
    
    // If any open parens were never closed close them both in the original
    // search expression as well as in the bitwise expression.
    for (;openCount--;) {
      searchExpression += ')';
      // Doubled because opening is doubled so that "g" variable can be defined.
      bitExpr += '))';
      logicExpr += ')';
    }
    // console.log({bitExpr, logicExpr});

    var testBody = bitExpr; // test() function body
    var matchBody = 'r=' + bitExpr; // exec() function body
    var matches = []; // Array of not negated objects used to indicate the matches
    var resetCode = ''; // Code to reset the regexes every time test() is called
    // Header code for each function.
    var headerCode = 'var s="string"===typeof x,f=!s&&('
      + JSON.stringify(fields)
      + '||Object.keys(x));';

    // Get the code which will be used in the wrapper functions.  First declare
    // all of the paren group variables;
    for (var wrapperCode = 'var '; groupCount; wrapperCode += 'g' + (groupCount--) + ',');
    wrapperCode += termParts.map(function(part) {
      var partName = part.name; // Term variable name from before
      var constName = 'c' + partName.slice(1); // Name of part object
      var varName = 'v' + partName.slice(1); // Name of the RegExp result
      // Used to correctly replace each term in the code with the RegExp#test() or
      // RegExp#exec().
      var rgxTerm = new RegExp('\\b' + partName + '\\b');

      // Add the resets for all of the regexes.
      resetCode += partName + '.lastIndex=0,';

      // Replace each term placeholder with actual code.
      testBody = testBody.replace(rgxTerm, '((s?$&.test("string"===typeof x?x:[x].join("")):(' + constName + '.fields||f).some(function(k){return $&.test([x[k]].join(""))}))?1:0)');
      matchBody = matchBody.replace(rgxTerm, '((s?x.replace($&,function(){for(var m=[],a=arguments,i=a.length;i--;)void 0===m.input&&("object"===typeof a[i]&&(m.groups=a[i--]),m.input=a[i--],m.index=a[i--]),m[i]=a[i];' + varName + '.push(m)}):(' + constName + '.fields||f).forEach(function(k){[x[k]].join("").replace($&,function(){for(var m=[],a=arguments,i=a.length;i--;)void 0===m.input&&("object"===typeof a[i]&&(m.groups=a[i--]),m.input=a[i--],m.index=a[i--],m.field=k),m[i]=a[i];' + varName + '.push(m)})}),' + varName + '.length)?1:0)');

      // Filter out negated results from the returned array for exec().
      if (!part.negate) {
        matches.push('{search:' + constName + '.match,searchIndex:' + constName + '.index,matches:(g' + part.groups.join('&&g') + ')&&' + varName + '}');
      }

      // Define the variable which stores the matches at the beginning of
      // Search#exec().
      matchBody = varName + '=[],' + matchBody;

      // Define the part object and define the term RegExp all in the header of
      // the wrapper function.
      return constName + '=' + JSON.stringify(part) + ','
        + partName + '=new RegExp(' + constName + '.value[0], ' + constName + '.value[1])';
    }).join(',') + ';';

    // Keep the original expression.
    this._value = searchExpression;

    // Makes a custom test() function which takes one string argument and returns
    // a boolean indicating if the string matches the search expression or not.
    this.test = Function(
      wrapperCode
      + 'return function(x){'
      + headerCode
      + 'return !!('
      + resetCode
      + testBody
      + ')}'
    )();

    // Makes a custom exec() function which takes one string argument and returns
    // an array of the matched substrings or false if the search expression
    // didn't match.
    this.exec = Function(
      wrapperCode
      + 'return function(x){'
      + headerCode
      + 'var '
      + matchBody
      + ';return !!r&&['
      + matches.join(',')
      + '].filter(function(m){return m.matches})}'
    )();
  }

  Pattern.prototype = {
    constructor: Pattern,
    /**
     * Gets the search expression.
     * @returns {string}
     *   The search expression as a string.
     */
    valueOf: function() {
      return this._value;
    }
  };

  const Logic = (function() {
    const OPS_IN_ORDER = ['AND', 'XOR', "OR"];
    const AFTER_GRAMMAR_HASH = {
      GROUP_OPEN: ['GROUP_OPEN', 'VARIABLE'],
      VARIABLE: ['OPERATOR', 'GROUP_CLOSE'],
      OPERATOR: ['GROUP_OPEN', 'VARIABLE'],
      GROUP_CLOSE: ['GROUP_CLOSE', 'OPERATOR']
    };

    function Logic(expr, opt_varLimit) {
      if (!opt_varLimit) {
        opt_varLimit = this._varLimit || Infinity;
      }

      let {root, vars} = parseExpression(expr, opt_varLimit);
      
      return Object.assign(
        this,
        {
          _expr: expr,
          _varLimit: opt_varLimit,
          _root: simplify(root),
          _vars: vars
        }
      );
    }

    Logic.prototype = {
      constructor: Logic,

      toString() {
        return stringifyLogic(this._root);
      },

      remove(vars, opt_varLimit) {
        const varLimit = opt_varLimit || this._varLimit;
        for (let i = vars.length; i--; ) {
          let curVar = vars[i];
          if (vars.indexOf(curVar) < i || curVar < 1 || curVar > varLimit || curVar !== ~~curVar) {
            vars.splice(i, 1);
          }
        }
        vars.sort((a, b) => a - b);

        let varsFound = removeRecurse(this._root, vars);
        
        return Object.assign(this, {
          _varLimit: opt_varLimit ? varLimit : (this._varLimit - vars.length),
          _root: simplify(this._root, true),
          _expr: this + '',
          _vars: varsFound
        });
      },

      eval(values) {
        return evalValues(values, this._root);
      },

      update(expr, opt_varLimit) {
        return Logic.call(this, expr, opt_varLimit);
      },

      getVarLimit() {
        return this._varLimit;
      },

      getExpression() {
        return this._expr;
      },

      getVars() {
        return this._vars;
      },
      
      getVarsCount() {
        return this._vars.length;
      },

      hasWarnings() {
        return this._warnings.length > 0;
      },

      getPermutations() {
        const vars = this._vars;
        const varCount = vars.length;
        const permuteCount = 1 << varCount;
        const successes = [];
        const failures = [];
        for (let i = 0; i < permuteCount; i++) {
          let values = [];
          for (let j = 0; j < varCount; j++) {
            values[vars[j] - 1] = ((1 << j) & i) > 0;
          }
          (evalValues(values, this._root) ? successes : failures).push(values);
        }
        return { successes, failures };
      }
    };

    function parseExpression(expr, opt_varLimit) {
      // If expression is blank...
      if (expr.trim() === '') {
        throw new Error('Expression cannot be blank.');
      }

      let root = {
        grammar: 'GROUP_OPEN',
        negate: false,
        members: [],
        operators: []
      };
      let stack = [];
      let level = root;
      let lastGrammar = 'GROUP_OPEN';
      let vars = [];

      expr.replace(
        /(\bNOT\()|(\()|(\))|\b(?:(AND)|(OR)|(XOR))\b|(\b[1-9]\d*\b)|(\s+)|\S+/g,
        function(m, openNot, open, close, and, or, xor, digits, spaces, position) {
          if (spaces) return; // Skip spacing

          position++; // Make position

          let grammar = (openNot || open)
            ? 'GROUP_OPEN'
            : close
              ? 'GROUP_CLOSE'
              : (and || or || xor)
                ? 'OPERATOR'
                : digits
                  ? 'VARIABLE'
                  : undefined;

          // If grammar is unrecognized...
          if (!grammar) {
            throw new Error('Unexpected character' + (m.length === 1 ? '' : 's') + ' at position ' + position + ':  ' + m);
          }

          // If grammar is not expected based on the previous one...
          const expectedGrammars = AFTER_GRAMMAR_HASH[lastGrammar];
          if (expectedGrammars.indexOf(grammar) < 0) {
            throw new Error('Unexpected ' + grammar + ' ("' + m + '") at position ' + position + '.  Expected one of the following grammars:  ' + expectedGrammars.join(', '));
          }

          // Puts the grammar into the hierarchy.
          if (grammar === 'GROUP_OPEN') {
            let newLevel = {
              grammar,
              negate: !open,
              members: [],
              text: m,
              operators: []
            };
            level.members.push(newLevel);
            stack.push(level);
            level = newLevel;
          }
          else if (grammar === 'GROUP_CLOSE') {
            level = stack.pop();
            if (!level) {
              throw new Error('Unexpected ' + grammar + ' at position ' + position + ' due to corresponding GROUP_OPEN.');
            }
          }
          else {
            if (grammar === 'OPERATOR') {
              const {operators} = level;
              if (operators.indexOf(m) < 0) {
                operators.push(m);
              }
            }
            else if (grammar === 'VARIABLE') {
              m = +m;
              if (m > opt_varLimit || m < 1) {
                throw new Error(grammar + ' at position ' + position + ' is ' + digits + ' but should be a positive number less than or equal to ' + opt_varLimit + '.');
              }
              if (vars.indexOf(m) < 0) {
                vars.push(m);
              }
            }
            level.members.push({ grammar, text: m, position });
          }

          lastGrammar = grammar;
        }
      )

      // If not ending with an empty group and lastGrammar cant be followed by a closing paren...
      if (level.members.length && AFTER_GRAMMAR_HASH[lastGrammar].indexOf('GROUP_CLOSE') < 0) {
        throw new Error('Unexpected ' + lastGrammar + ' ending expression at position ' + level.members.slice(-1)[0].position + '.');
      }

      // If there are some unclosed parentheses...
      if (stack.length) {
        throw new Error('Unexpectedly ended expression without closing ' + stack.length + ' parenthetical group' + (stack.length === 1 ? '.' : 's.'));
      }

      return {
        root: groupByOps(root),
        vars: vars.sort((a, b) => a - b)
      };
    }
    

    function groupByOps(level) {
      const {members, operators} = level;
      let opsOnLevel = operators.length;
      OPS_IN_ORDER.forEach((OP_TO_FIND, opIndex) => {
        for (let lastOp, newLevel, i = 0; i < members.length; i++) {
          const member = members[i];
          const {grammar} = member;
          // If member is a group
          if (grammar === 'GROUP_OPEN' && !opIndex) {
            members[i] = groupByOps(member);
          }
          // If found operator...
          if (i && grammar !== 'OPERATOR' && members[i - 1].grammar === 'OPERATOR') {
            const op = members[i - 1].text;
            if (op === OP_TO_FIND) {
              i--;
              if (opsOnLevel > 1) {
                if (op === lastOp) {
                  newLevel.members.push(members.splice(i--, 2)[1]);
                }
                else {
                  newLevel = {
                    grammar: 'GROUP_OPEN',
                    negate: false,
                    text: '(',
                    operators: [op]
                  };
                  newLevel.members = [members[i - 1], members[i + 1]];
                  members.splice(--i, 3, newLevel);
                }
              }
              else {
                members.splice(i, 1);
              }
            }
            lastOp = op;
          }
        }
        const levelOpIndex = operators.indexOf(OP_TO_FIND);
        if (levelOpIndex >= 0 && opsOnLevel > 1) {
          opsOnLevel--;
          operators.splice(levelOpIndex, 1);
        }
      });

      return level;
    }

    function stringifyLogic(level, isRoot) {
      let result = level.text || '';
      result += level.members.map(member => {
        return member.grammar === 'GROUP_OPEN'
          ? stringifyLogic(member)
          : member.text;
      }).join(' ' + level.operators[0] + ' ');
      return result + (level.text ? ')' : '');
    }

    function simplify(level, isRoot) {
      const {members} = level;
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        if (member.grammar === 'GROUP_OPEN') {
          members[i] = simplify(member);
          if (member.members.length === 1 && !member.negate && member.members[0].grammar === 'VARIABLE') {
            members[i] = member.members[0];
          }
        }
      }
      if (members.length === 1 && members[0].grammar === 'GROUP_OPEN') {
        const negate = members[0].negate !== level.negate;
        return Object.assign(members[0], {
          negate,
          text: negate ? 'NOT(' : isRoot ? '' : '('
        });
      }
      return level;
    }

    function removeRecurse(level, varsToRemove, varsFound) {
      const isRoot = !varsFound;
      if (isRoot) {
        varsFound = [];
      }
      for (let {members} = level, i = 0; i < members.length; i++) {
        let member = members[i];
        if (member.grammar === 'GROUP_OPEN') {
          removeRecurse(member, varsToRemove, varsFound);
          if (!member.members.length) {
            members.splice(i--, 1);
          }
        }
        else {
          let {text} = member;
          if (varsToRemove.indexOf(text) >= 0) {
            members.splice(i--, 1);
          }
          else {
            for (let j = varsToRemove.length; j--; ) {
              if (varsToRemove[j] < text) {
                text = member.text -= j + 1;
                break;
              }
            }
          }
          if (varsFound.indexOf(text) < 0) {
            varsFound.push(text);
          }
        }
      }
      return varsFound.sort((a, b) => a - b);
    }

    function evalValues(values, level) {
      let operator = level.operators[0] || 'XOR';
      const {negate} = level;
      let result = operator === 'AND';
      for (let {members} = level, i = 0, l = members.length; i < l; i++) {
        let member = members[i];
        let value = member.grammar === 'GROUP_OPEN'
          ? evalValues(values, member)
          : !!values[member.text - 1];
        if (operator === 'XOR') {
          result = result !== value;
        }
        else if ((operator === 'OR') === value) {
          return negate !== value;
        }
      }
      return negate !== result;
    }

    return Logic;
  })();

  return {
    Pattern,
    Logic
  };
})();

export default Matchly;
// new Matchly.Pattern('hello world XOR you +are cute')