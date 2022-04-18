const _agGridFrameListeners = [];

window.addEventListener('message', e => {
  for (let listener, i = _agGridFrameListeners.length; i--; ) {
    listener = _agGridFrameListeners[i];

    // Make sure the message comes from the listener's frame and is the event is
    // of the smae type.
    if (listener.target === e.source && listener.type === e.data.type) {
      try {
        const {frame} = listener;
        listener.callback(
          e.data.data,
          (calls) => frame.contentWindow.postMessage({calls}, '*'),
          frame
        );
      }
      catch (err) {
        console.error(err);
      }
    }
  }
});

/**
 * @typedef {Object} GridCall
 * @property {string[]} path
 * @property {any[]=} args
 */

/**
 * @callback GridCallback
 * @param {any} data
 * @param {(calls: GridCall[]) => void} caller
 * @param {HTMLIFrameElement} frame
 */

/**
 * @param {HTMLIFrameElement|string} frame 
 * @param {string} eventName 
 * @param {GridCallback} callback 
 */
function listenToAgGridFrame(frame, eventName, callback) {
  if ('string' === typeof frame) {
    frame = document.querySelector(frame);
  }
  const frameWindow = frame.contentWindow || frame.contentWindow.defaultView;
  _agGridFrameListeners.push({
    target: frameWindow,
    frame: frame,
    type: eventName,
    callback: callback
  });
}

document.addEventListener('DOMContentLoaded', () => {
  listenToAgGridFrame('#agGridFrame', 'ready', (data, call) => {
    call([
      {
        path: ['setIsDark'],
        args: [false]
      },
      {
        path: ['api', 'setColumnDefs'],
        args: [
          [
            { field: "make", sortable: true, resizable: true, flex: 1, minWidth: 150 },
            { field: "model", sortable: true, resizable: true, flex: 1, minWidth: 150 },
            { field: "price", sortable: true, resizable: true, flex: 1, minWidth: 150, filter: 'agNumberColumnFilter' }
          ]
        ]
      },
      {
        path: ['api', 'setRowData'],
        args: [
          [
            { make: "Toyota", model: "Celica", price: 35000 },
            { make: "Ford", model: "Mondeo", price: 32000 },
            { make: "Porsche", model: "Boxter", price: 72000 },
            { make: "Porsche", model: "Boxter", price: 72000 }
          ]
        ]
      },
      // { path: ['columnApi', 'autoSizeAllColumns'] }
    ]);
  });
});
