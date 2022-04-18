import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './SimplePanel';
import { DownloadEditorInfo } from 'downloadEditorInfo';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions(function(builder) {
  return builder
    .addTextInput({
      category: ['Download'],
      name: 'Name Pattern',
      path: 'downloadNamePattern',
      defaultValue: '<PANEL> (<NOW>).<EXT>',
    })
    .addCustomEditor({
      category: ['Download'],
      editor: DownloadEditorInfo,
      id: 'downloadEditorInfo',
      name: null as any,
      path: 'downloadEditorInfo',
    });
});
