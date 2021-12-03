import React, { useState } from 'react';
import { Button /*Modal*/ } from '@grafana/ui';
import { PanelProps, urlUtil } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColumnMovedEvent, ColumnPinnedEvent, SortChangedEvent, ColumnApi, GridApi } from 'ag-grid-community';
import utils from './utils';
import XLSX from 'xlsx';

// Include AG Grid CSS
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.min.css';
import 'ag-grid-community/dist/styles/ag-theme-balham-dark.min.css';

interface Props extends PanelProps<SimpleOptions> {}

export const SimplePanel: React.FC<Props> = props => {
  let { options, data, width, height } = props;
  console.log({ props });

  // let [modalIsOpen, setModalIsOpen] = useState(false);
  let [tempColDefs, setTempColDefs] = useState(options.columnDefs);

  // Setup isEditing as a state property.
  const [isEditing, setIsEditing] = useState(!!urlUtil.getUrlSearchParams().editPanel);
  setTimeout(_ => {
    try {
      let newIsEditing = !!urlUtil.getUrlSearchParams().editPanel;
      if (isEditing !== newIsEditing) {
        setIsEditing(newIsEditing);
      }
    } catch (e) {}
  }, 50);

  // const onModalClose = () => {
  //   setModalIsOpen(false);
  // };

  const styles = getStyles();
  const theme = useTheme();
  let gridRef: any = React.useRef(null);

  try {
    const defaultColDef: ColDef = {
      resizable: true,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 100,
    };

    const series1 = data.series[0];
    const fields1 = data.series[0].fields;

    // Get a list of unique column IDs based on the field names passed from the first query.
    const colIds = fields1.reduce<string[]>((colIds, field) => {
      let colId = field.name
        .replace(/[A-Z]|\d+/g, '_$&')
        .toLowerCase()
        .replace(/[^a-z\d]+/g, '_')
        .replace(/^_(?!\d)|_$/g, '');
      if (colIds.includes(colId)) {
        let i = 0;
        while (colIds.includes(`${colId}_${++i}`)) {}
        colId = `${colId}_${i}`;
      }
      return colIds.concat([colId]);
    }, []);

    // Get the row data as an array of objects.
    const rowData: any[] = [];
    for (let rowIndex = 0, rowCount = series1.length; rowIndex < rowCount; rowIndex++) {
      rowData.push(
        fields1.reduce(
          (row, field, fieldIndex) => Object.assign(row, { [colIds[fieldIndex]]: field.values.get(rowIndex) }),
          {}
        )
      );
    }

    // Get the column definitions keeping what is already there if possible.
    const savedColDefs = Object(options.columnDefs);
    const colDefs = fields1
      .map((field, index) => {
        const colId = colIds[index];
        return Object.assign(
          { headerName: field.name, colId, field: colId },
          defaultColDef,
          Object(savedColDefs[colId])
        );
      })
      .sort((a, b) => a.index - b.index);

    /**
     * Called whenever a column moves, is sorted or pinned.
     * @param e
     */
    const onColumnUpdated = (e: ColumnMovedEvent | ColumnPinnedEvent | SortChangedEvent) => {
      setTempColDefs(
        (tempColDefs = (e.api.getColumnDefs() || []).reduce(
          (colDefs, { colId, hide, resizable, sortable, sortIndex, sort, pinned }: ColDef, index) => {
            return Object.assign(colDefs, {
              [colId as string]: { colId, hide, resizable, sortable, sortIndex, sort, pinned, index },
            });
          },
          {}
        ))
      );
      if (isEditing) {
        options.columnDefs = tempColDefs;
      }
    };

    return (
      <div
        className={cx(
          styles.wrapper,
          css`
            width: ${width}px;
            height: ${height}px;
          `
        )}
      >
        <div
          className={css`
            display: table;
            width: 100%;
            height: 100%;
          `}
        >
          <div
            className={css`
              display: table-row;
            `}
          >
            <div
              className={css`
                display: table-cell;
                height: 1px;
              `}
            >
              <Button
                icon="cloud-download"
                onClick={x =>
                  (gridRef.current as { api: GridApi }).api.exportDataAsCsv({
                    fileName: utils.interpret(options.downloadNamePattern, {
                      PANEL() {
                        return props.title;
                      },
                      EXT() {
                        return 'csv';
                      },
                    }),
                  })
                }
              >
                CSV&hellip;
              </Button>

              <Button
                icon="cloud-download"
                onClick={x => {
                  const { api, columnApi } = gridRef.current as { api: GridApi; columnApi: ColumnApi };
                  let cols = columnApi.getAllDisplayedColumns();
                  // NOTE:  Get column widths right away to avoid strange width
                  // reporting later on.
                  let wsCols = cols.map(c => ({ wpx: c.getActualWidth() }));
                  let rows = (api.getModel() as any).rowsToDisplay as any[];

                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.aoa_to_sheet(
                    [cols.map(c => columnApi.getDisplayNameForColumn(c, null))].concat(
                      rows.map(r =>
                        cols.map(c =>
                          utils.parseXLSXValue(r.data[(c.getUserProvidedColDef() as ColDef).field as string])
                        )
                      )
                    )
                  );
                  ws['!cols'] = wsCols;
                  XLSX.utils.book_append_sheet(wb, ws, 'AIR Intel Data');

                  const wbOut = XLSX.write(wb, {
                    bookType: 'xlsx',
                    bookSST: true,
                    type: 'binary',
                  });
                  const wbOutBin64 = btoa(wbOut);
                  Object.assign(document.createElement('a'), {
                    href: `data:;base64,${wbOutBin64}`,
                    download: utils.interpret(options.downloadNamePattern, {
                      PANEL() {
                        return props.title;
                      },
                      EXT() {
                        return 'xlsx';
                      },
                    }),
                  }).click();
                }}
              >
                Excel&hellip;
              </Button>

              {/* { isEditing
                ? <>
                    <div>{new Date() + ''}</div>
                    <Button onClick={() => setModalIsOpen(true)}>Open modal</Button>
                    <Modal title="My Message" isOpen={modalIsOpen}>
                      Hello world!!!
                      <Button variant="primary" onClick={onModalClose}>
                        Close
                      </Button>
                    </Modal>
                  </>
                : null
              } */}
            </div>
          </div>
          <div
            className={css`
              display: table-row;
            `}
          >
            <div
              className={css`
                display: table-cell;
              `}
            >
              <div
                className={theme.isDark ? 'ag-theme-balham-dark' : 'ag-theme-balham'}
                style={{ height: '100%', width: '100%' }}
              >
                <AgGridReact
                  ref={gridRef}
                  rowData={rowData}
                  defaultColDef={defaultColDef}
                  onColumnMoved={onColumnUpdated}
                  onColumnPinned={onColumnUpdated}
                  onSortChanged={onColumnUpdated}
                  columnDefs={colDefs}
                ></AgGridReact>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (e) {
    console.error('Error:', e);
    return (
      <div>
        <h2>Error</h2>
        <pre>{e.message}</pre>
      </div>
    );
  }
};

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      position: relative;
    `,
  };
});
