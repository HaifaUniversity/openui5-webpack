const LocalModulesHelpers = require('webpack/lib/dependencies/LocalModulesHelpers');
const LocalModuleDependency = require('webpack/lib/dependencies/LocalModuleDependency');
const DefineDependency = require('./DefineDependency');
const RequireItemDependency = require('./RequireItemDependency');

class DefineDependencyParserPlugin {
  constructor(options) {
    this.options = options;
  }

  newDefineDependency(range, arrayRange, functionRange, namedModule) {
    return new DefineDependency(range, arrayRange, functionRange, namedModule);
  }

  apply(parser) {
    const processItem = (expr, param, namedModule) => {
      let dep;
      const localModule = LocalModulesHelpers.getLocalModule(parser.state, param.string, namedModule);
      if (localModule) {
        dep = new LocalModuleDependency(localModule, param.range);
      } else {
        dep = new RequireItemDependency(param.string, param.range);
      }
      dep.loc = expr.loc;
      parser.state.current.addDependency(dep);
      return true;
    };

    const processArray = (expr, param, namedModule) => {
      param.items.forEach((param) => {
        processItem(expr, param, namedModule);
      });
      return true;
    };

    parser.hooks.call.for('sap.ui.define').tap('OpenUI5Plugin', (expr) => {
      let array;
      let fn;
      let namedModule;

      switch (expr.arguments.length) {
        case 1:
          fn = expr.arguments[0];
          break;
        case 2:
          if (expr.arguments[0].type === 'Literal') {
            namedModule = expr.arguments[0].value;
            fn = expr.arguments[1];
          } else if (expr.arguments[0].type === 'ArrayExpression') {
            array = expr.arguments[0];
            fn = expr.arguments[1];
          } else {
            fn = expr.arguments[0];
          }
          break;
        case 3:
          if (expr.arguments[0].type === 'Literal') {
            namedModule = expr.arguments[0].value;
            array = expr.arguments[1];
            fn = expr.arguments[2];
          } else {
            array = expr.arguments[0];
            fn = expr.arguments[1];
          }
          break;
        case 4:
          namedModule = expr.arguments[0].value;
          array = expr.arguments[1];
          fn = expr.arguments[2];
        // no default
      }

      if (array) {
        const param = parser.evaluateExpression(array);
        const result = processArray(expr, param, namedModule);
        if (!result) return false;
      }

      if (fn && fn.type === 'FunctionExpression') {
        if (fn.body.type === 'BlockStatement') {
          parser.walkStatement(fn.body);
        } else {
          parser.walkExpression(fn.body);
        }
      }

      const dep = this.newDefineDependency(
        expr.range,
        array ? array.range : null,
        fn ? fn.range : null,
        namedModule || null,
      );
      dep.loc = expr.loc;
      if (namedModule) {
        dep.localModule = LocalModulesHelpers.addLocalModule(parser.state, namedModule);
      }
      parser.state.current.addDependency(dep);
      return true;
    });
  }
}
module.exports = DefineDependencyParserPlugin;
