import React from 'react';
import utils from './utils';
import { StandardEditorProps } from '@grafana/data';
import { css } from 'emotion';

interface Settings {}

export const DownloadEditorInfo: React.FC<StandardEditorProps<string, Settings>> = props => {
  // const options: Array<SelectableValue<number>> = [];

  // Default values
  // const from = item.settings?.from ?? 1;
  // const to = item.settings?.to ?? 10;

  // for (let i = from; i <= to; i++) {
  //   options.push({
  //     label: i.toString(),
  //     value: i,
  //   });
  // }

  return (
    <div
      className={css`
        margin-top: -1.5em;
      `}
    >
      <h3>Partial Output</h3>
      <pre>{utils.interpret(props.context.options.downloadNamePattern)}</pre>
      <h3>Special Meta Groups</h3>
      <ul
        className={css`
          margin: 0 1.5em;
        `}
      >
        <li>
          <b>
            <u>
              <code>&lt;PANEL&gt;</code>
            </u>
          </b>
          <br />
          Will be replaced with the title of the panel (only when downloaded).
        </li>
        <li>
          <b>
            <u>
              <code>&lt;EXT&gt;</code>
            </u>
          </b>
          <br />
          Will be replaced with the standard lowercased extension (only when downloaded).
        </li>
        <li>
          <b>
            <u>
              <code>&lt;NOW&gt;</code>
            </u>
          </b>
          <br />
          <ul
            className={css`
              margin: 0 1.5em;
            `}
          >
            <li>Will be replaced with the current date and time.</li>
            <li>
              <b>
                <u>
                  <code>
                    &lt;NOW format="
                    <a href="https://momentjs.com/docs/#/displaying/format/" target="_blank">
                      <i>&#123;momentjs_format&#125;</i>
                    </a>
                    "&gt;
                  </code>
                </u>
              </b>
              <br />
              Will be replaed with the current date/time in the specified{' '}
              <a href="https://momentjs.com/docs/#/displaying/format/" target="_blank">
                moment.js format (click here for more information)
              </a>
              .
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
};
