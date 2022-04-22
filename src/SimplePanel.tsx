import React, { useState } from 'react';
import { Button, Input, Modal, Checkbox } from '@grafana/ui';
import { PanelProps, urlUtil } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColumnMovedEvent, ColumnPinnedEvent, SortChangedEvent, ColumnApi, GridApi } from 'ag-grid-community';
import utils from './utils';
import XLSX from 'xlsx';
import Matchly from './libs/Matchly';
console.log(Matchly);

// Include AG Grid CSS
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.min.css';
import 'ag-grid-community/dist/styles/ag-theme-balham-dark.min.css';


const STRING_COMPARATOR_NAMES = {
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  contains: 'includes'
};

const FILTER_OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'startsWith', label: 'Starts With' },
  { value: 'endsWith', label: 'Ends With' },
  { value: 'contains', label: 'Includes' }
];


interface Props extends PanelProps<SimpleOptions> {}

class Filter {
  parts: {
    value?: string | number | boolean,
    operator?: string,
    field?: string
  }[]
  expression?: string
  isActive: boolean
  expressionError?: string

  constructor(options: {parts?: any, expression?: any, isActive?: any, expressionError?: any}) {
    this.parts = options.parts ?? [];
    this.expression = options.expression ?? '';
    this.isActive = options.isActive ?? false;
    this.expressionError = options.expressionError ?? undefined;
  }

  get isValid() {
    const FILTER_OPERATOR_VALUES = FILTER_OPERATORS.map(o => o.value);
    return !this.expressionError
      && !this.parts.find(x => !x.field || !FILTER_OPERATOR_VALUES.includes(x.operator as any));
  }

  clone() {
    return new Filter(utils.copyJSON(this));
  }
}

export const SimplePanel: React.FC<Props> = props => {
  let { options, data, width, height } = props;
  console.log({ props });

  let [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  let [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  let [tempColDefs, setTempColDefs] = useState(options.columnDefs);
  let [downloadNamePattern, setDownloadNamePattern] = useState(options.downloadNamePattern);
  let [persistentFilter, setPersistentFilter] = useState(new Filter({ isActive: true }));
  let [filterBeingEdited, setFilterBeingEdited] = useState(new Filter({ isActive: true }));

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
    let rowData: any[] = [];
    for (let rowIndex = 0, rowCount = series1.length; rowIndex < rowCount; rowIndex++) {
      rowData.push(
        fields1.reduce(
          (row, field, fieldIndex) => Object.assign(row, { [colIds[fieldIndex]]: field.values.get(rowIndex) }),
          {}
        )
      );
    }

    if (persistentFilter.expression) {
      const logicExpr = new Matchly.Logic(persistentFilter.expression);
      rowData = rowData.filter(row => {
        const logicValues = persistentFilter.parts.map(({field, operator, value: filterValue}) => {
          let value = row[field as string];
          const valueType = typeof value;
          const filterValueType = typeof filterValue;
          
          const stringComparator: string | undefined = (STRING_COMPARATOR_NAMES as any)[operator as string];
          if (stringComparator) {
            return ((value ?? '') + '' as any)[stringComparator]((filterValue ?? '') + '');
          }
          if (valueType !== filterValueType) {
            if (value != null) {
              value += '';
            }
            if (filterValue != null) {
              filterValue += '';
            }
          }
          return operator === 'eq'
            ? value === filterValue
            : operator === 'neq'
              ? value !== filterValue
              : operator === 'lt'
                ? value < (filterValue as any)
                : operator === 'lte'
                  ? value <= (filterValue as any)
                  : operator === 'gt'
                    ? value > (filterValue as any)
                    : value >= (filterValue as any);
        });
        return logicExpr.eval(logicValues);
      });
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

    const downloaders = [
      {
        type: 'Comma Delimited (CSV)',
        name: utils.interpret(downloadNamePattern, {
          PANEL() {
            return props.title;
          },
          EXT() {
            return 'csv';
          },
        }),
        callback() {
          (gridRef.current as { api: GridApi }).api.exportDataAsCsv({
            fileName: this.name,
          });
        }
      },
      {
        type: 'Pipe Delimited (PSV)',
        name: utils.interpret(downloadNamePattern, {
          PANEL() {
            return props.title;
          },
          EXT() {
            return 'psv';
          },
        }),
        callback() {
          (gridRef.current as { api: GridApi }).api.exportDataAsCsv({
            fileName: this.name,
            columnSeparator: '|'
          });
        }
      },
      {
        type: 'Tab Delimited (TSV)',
        name: utils.interpret(downloadNamePattern, {
          PANEL() {
            return props.title;
          },
          EXT() {
            return 'tsv';
          },
        }),
        callback() {
          (gridRef.current as { api: GridApi }).api.exportDataAsCsv({
            fileName: this.name,
            columnSeparator: '\t'
          });
        }
      },
      {
        type: 'Excel Workbook (XLSX)',
        name: utils.interpret(downloadNamePattern, {
          PANEL() {
            return props.title;
          },
          EXT() {
            return 'xlsx';
          },
        }),
        callback() {
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
            download: this.name,
          }).click();
        }
      },
    ].sort((a, b) => a.type < b.type ? -1 : 1);

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
                onClick={() => {
                  setIsDownloadModalOpen(true);
                }}
              >
                Download&hellip;
              </Button>

              <Button
                icon="filter"
                onClick={() => {
                  setIsFilterModalOpen(true);
                }}
              >
                Filter&hellip;
              </Button>

              <Modal title="Download&hellip;" isOpen={isDownloadModalOpen} onDismiss={() => setIsDownloadModalOpen(false)}>

                <label style={{width: '100%'}}>
                  Naming Pattern
                  <Input
                  type="text"
                  value={downloadNamePattern}
                  onChange={e => setDownloadNamePattern(e.currentTarget.value)}
                  css={undefined}
                  />
                </label>

                {
                  downloaders.map(downloader => (
                    <table style={{width: '100%', margin: '0.5em 0'}} key={downloader.type}>
                      <tbody>
                        <tr>
                          <td>
                            <Input
                              css=""
                              type="text"
                              readOnly={true}
                              value={downloader.name}
                              onClick={e => e.currentTarget.select()}
                            />
                          </td>
                          <td style={{width: 1}}>
                            <Button icon="cloud-download" onClick={downloader.callback.bind(downloader)}>{downloader.type}</Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))
                }

              </Modal>

              <Modal
                title="Filter&hellip;"
                isOpen={isFilterModalOpen}
                onDismiss={() => setIsFilterModalOpen(false)}
                className={css`width: 90%;`}
              >
                {
                  filterBeingEdited.parts.length
                    ? (
                      <>
                        <label style={{width: '100%'}}>
                          Numeric Conditions Expression
                          <Input
                            type="text"
                            value={filterBeingEdited.expression}
                            onChange={
                              e => {
                                let {value} = e.currentTarget;
                                try {
                                  new Matchly.Logic(value, filterBeingEdited.parts.length);
                                  filterBeingEdited.expressionError = undefined;
                                }
                                catch (exc) {
                                  filterBeingEdited.expressionError = (exc as Error).message;
                                }
                                filterBeingEdited.expression = value;
                                setFilterBeingEdited(filterBeingEdited.clone());
                              }
                            }
                            css={undefined}
                          />
                          {
                            filterBeingEdited.expressionError
                            && (
                              <span className={css`color: #F00;`}>{filterBeingEdited.expressionError}</span>
                            )
                          }
                        </label>

                        <table className={css`
                          width: 100%;
                        `}>
                          <thead>
                            <tr>
                              <th className={css`width: 1px;`}></th>
                              <th>Field</th>
                              <th className={css`width: 1px;`}>Operator</th>
                              <th className={css`width: 99%;`}>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {
                              filterBeingEdited.parts.map((filter, filterIndex) => (
                                <tr key={`filter${filterIndex}`}>
                                  <td className={css`white-space: nowrap;`}>
                                    <div
                                      className={css`
                                        display: inline-block;
                                        line-height: 1.5em;
                                        min-width: 2em;
                                        border-radius: 2em;
                                        box-shadow: 0 0 0.3em 0.2em #fff, 0 0 0em 0.3em #000;
                                        background-color: #777;
                                        color: #FFF;
                                        font-size: 0.8em;
                                        font-weight: bold;
                                        font-family: Tahoma;
                                        padding: 0.25em;
                                        text-align: center;
                                        margin: 0.5em;
                                      `}
                                    >{filterIndex + 1}</div>
                                    <Button
                                      variant="destructive"
                                      icon="trash-alt"
                                      disabled={!filterBeingEdited.isValid}
                                      onClick={
                                        e => {
                                          const expr = filterBeingEdited.expression;
                                          const count = filterBeingEdited.parts.length;
                                          filterBeingEdited.expression = new Matchly.Logic(expr, count).remove([filterIndex + 1]).toString();
                                          filterBeingEdited.parts.splice(filterIndex, 1);
                                          setFilterBeingEdited(filterBeingEdited.clone());
                                        }
                                      }
                                    />
                                  </td>
                                  <td>
                                    <select
                                      className={css`width: auto;`}
                                      value={filter.field}
                                      onChange={
                                        e => {
                                          filterBeingEdited.parts[filterIndex].field = e.currentTarget.value;
                                          setFilterBeingEdited(filterBeingEdited.clone());
                                        }
                                      }
                                    >
                                      <option></option>
                                      {
                                        colDefs.map((colDef, colDefIndex) => (
                                          <option
                                            key={`filterField${filterIndex}_${colDefIndex}`}
                                            value={colDef.colId}
                                          >{colDef.headerName}</option>
                                        ))
                                      }
                                    </select>
                                  </td>
                                  <td>
                                    <select
                                      className={css`width: auto;`}
                                      value={filter.operator}
                                      onChange={
                                        e => {
                                          filterBeingEdited.parts[filterIndex].operator = e.currentTarget.value;
                                          setFilterBeingEdited(filterBeingEdited.clone());
                                        }
                                      }
                                    >
                                      <option></option>
                                      {
                                        FILTER_OPERATORS.map((o, opI) => (
                                          <option
                                            key={`filterOp${filterIndex}_${opI}`}
                                            value={o.value}
                                          >{o.label}</option>
                                        ))
                                      }
                                    </select>
                                  </td>
                                  <td>
                                    <Input
                                      type="text"
                                      value={(filter.value ?? '') + ''}
                                      onChange={
                                        e => {
                                          let value: (boolean | number | string) = e.currentTarget.value;
                                          if (!isNaN(+value)) {
                                            value = +value;
                                          }
                                          else if (['true', 'false'].includes(value)) {
                                            value = value === 'true';
                                          }
                                          filterBeingEdited.parts[filterIndex].value = value;
                                          setFilterBeingEdited(filterBeingEdited.clone());
                                        }
                                      }
                                      css={undefined}
                                    />
                                  </td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </>
                    )
                    : null
                }

                <div>
                  <Button
                    icon="plus-circle"
                    variant="secondary"
                    disabled={!filterBeingEdited.isValid}
                    onClick={
                      e => {
                        const newFilterNum = filterBeingEdited.parts.length + 1;
                        filterBeingEdited.parts.push({value: "", operator: undefined, field: ""});
                        filterBeingEdited.expression = newFilterNum === 1
                          ? '1'
                          : new Matchly.Logic(`(${filterBeingEdited.expression}) AND ${newFilterNum}`, newFilterNum).toString();
                        setFilterBeingEdited(filterBeingEdited.clone());
                      }
                    }
                  >
                    Add
                  </Button>
                </div>

                <div className={css`margin-top: 10px;`}>
                  <div className={css`margin: 0 5px; display: inline-block;`}>
                    <Checkbox
                      css=""
                      label="Is Active"
                      checked={filterBeingEdited.isActive}
                      onChange={
                        e => {
                          filterBeingEdited.isActive = e.currentTarget.checked;
                          setFilterBeingEdited(filterBeingEdited.clone());
                        }
                      }
                    />
                  </div>
                  <Button
                    icon="history"
                    variant="destructive"
                    disabled={!filterBeingEdited.isValid}
                    onClick={_ => setFilterBeingEdited(persistentFilter.clone())}
                  >
                    Reset
                  </Button>
                  <Button
                    icon="save"
                    disabled={!filterBeingEdited.isValid}
                    onClick={
                      _ => {
                        setPersistentFilter(filterBeingEdited.clone());
                        setIsFilterModalOpen(false)
                      }
                    }
                  >
                    Save
                  </Button>
                </div>

              </Modal>

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
        <pre>{(e as any).message}</pre>
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
