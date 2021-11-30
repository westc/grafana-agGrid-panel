import React from 'react';
import { PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { AgGridColumn, AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';
import { ColDef } from 'ag-grid-community';

interface Props extends PanelProps<SimpleOptions> {}

const theme = useTheme();

function createFlagImg(flag: string) {
  return `<img border="0" width="15" height="10" src="https://flags.fmcdn.net/data/flags/mini/${flag}.png"/>`;
}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height }) => {
  try {
    const styles = getStyles();

    const defaultColDef: ColDef = {
      resizable: true,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 100,
    };

    const getContextMenuItems = (params: any) => {
      var result = [
        {
          name: 'Alert ' + params.value,
          action: function() {
            window.alert('Alerting about ' + params.value);
          },
          cssClasses: ['redFont', 'bold'],
        },
        {
          name: 'Always Disabled',
          disabled: true,
          tooltip: 'Very long tooltip, did I mention that I am very long, well I am! Long!  Very Long!',
        },
        {
          name: 'Country',
          subMenu: [
            {
              name: 'Ireland',
              action: function() {
                console.log('Ireland was pressed');
              },
              icon: createFlagImg('ie'),
            },
            {
              name: 'UK',
              action: function() {
                console.log('UK was pressed');
              },
              icon: createFlagImg('gb'),
            },
            {
              name: 'France',
              action: function() {
                console.log('France was pressed');
              },
              icon: createFlagImg('fr'),
            },
          ],
        },
        {
          name: 'Person',
          subMenu: [
            {
              name: 'Niall',
              action: function() {
                console.log('Niall was pressed');
              },
            },
            {
              name: 'Sean',
              action: function() {
                console.log('Sean was pressed');
              },
            },
            {
              name: 'John',
              action: function() {
                console.log('John was pressed');
              },
            },
            {
              name: 'Alberto',
              action: function() {
                console.log('Alberto was pressed');
              },
            },
            {
              name: 'Tony',
              action: function() {
                console.log('Tony was pressed');
              },
            },
            {
              name: 'Andrew',
              action: function() {
                console.log('Andrew was pressed');
              },
            },
            {
              name: 'Kev',
              action: function() {
                console.log('Kev was pressed');
              },
            },
            {
              name: 'Will',
              action: function() {
                console.log('Will was pressed');
              },
            },
            {
              name: 'Armaan',
              action: function() {
                console.log('Armaan was pressed');
              },
            },
          ],
        },
        'separator',
        {
          name: 'Windows',
          shortcut: 'Alt + W',
          action: function() {
            console.log('Windows Item Selected');
          },
          icon: '<img src="https://www.ag-grid.com/example-assets/skills/windows.png" />',
        },
        {
          name: 'Mac',
          shortcut: 'Alt + M',
          action: function() {
            console.log('Mac Item Selected');
          },
          icon: '<img src="https://www.ag-grid.com/example-assets/skills/mac.png"/>',
        },
        'separator',
        {
          name: 'Checked',
          checked: true,
          action: function() {
            console.log('Checked Selected');
          },
          icon: '<img src="https://www.ag-grid.com/example-assets/skills/mac.png"/>',
        },
        'copy',
        'separator',
        'chartRange',
      ];
      return result;
    };

    const series1 = data.series[0];
    const fields1 = data.series[0].fields;
    const rowData: any[] = [];
    for (let rowIndex = 0, rowCount = series1.length; rowIndex < rowCount; rowIndex++) {
      rowData.push(
        fields1.reduce((row, field) => Object.assign(row, { [field.name]: field.values.get(rowIndex) }), {})
      );
    }

    console.log({ options, data, width, height, rowData });

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
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact
            rowData={rowData}
            defaultColDef={defaultColDef}
            enableRangeSelection={true}
            allowContextMenuWithControlKey={true}
            getContextMenuItems={getContextMenuItems}
          >
            {fields1.map(field => (
              <AgGridColumn key={field.name} field={field.name}></AgGridColumn>
            ))}
          </AgGridReact>
        </div>
      </div>
    );
  } catch (e) {
    console.log('Error:', e);
  }
};

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      position: relative;
    `,
  };
});
