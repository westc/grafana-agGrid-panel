import { dateTimeAsMoment } from "@grafana/data";

const RGX_INTERPRET_PROPS = /\s+(?<key>\w+)="(?<value>(?:""|[^"]+)*)"/g;

export default {
  interpret(pattern: string, metas?: {[k: string]: Function}, values?: {[k: string]: any}) {
    const nowMoment = dateTimeAsMoment(new Date);
    return pattern.replace(
      /<([A-Z]+)((?:\s+\w+="(?:""|[^"]+)*")*\s*)>/g,
      function(m, meta, strProps) {
        const props: {[k: string]: string} = {};
        for (let mProps; mProps = RGX_INTERPRET_PROPS.exec(strProps);) {
          let {key, value} = mProps.groups as {key: string, value: string};
          props[key] = value.replace(/""/g, '"');
        }
        return meta === 'NOW'
          ? nowMoment.format(props.format)
          : meta === 'TODAY'
            ? nowMoment.format(props.format ?? 'YYYY-MM-DD')
            : metas?.hasOwnProperty(meta)
              ? metas[meta](values)
              : m;
      }
    );
  }
};
