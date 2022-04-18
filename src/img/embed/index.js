// let the grid know which columns and what data to use
const gridOptions = {};

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', () => {
  window.mainGrid = new agGrid.Grid(
    document.querySelector('#myGrid'),
    gridOptions
  );
  triggerExternalEvent('ready', true);
});

function triggerExternalEvent(type, data) {
  window.parent.postMessage({type: type, data: data}, '*');
}

window.addEventListener('message', e => {
  var data = e.data;
  if ('calls' in data) {
    data.calls.forEach(function(call) {
      var target;
      var path = call.path;
      var joinedPath = path.join('.');
      if (joinedPath === 'setIsDark') {
        document.querySelector('#myGrid').className = 'ag-theme-alpine' + (call.args[0] ? '-dark' : '');
      }
      else {
        var func = path.reduce(function(func, name) {
          target = func;
          return func[name];
        }, window.mainGrid.gridOptions);
        func.apply(target, call.args ?? []);
      }
    });
  }
});
