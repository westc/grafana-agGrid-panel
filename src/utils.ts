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
          : metas?.hasOwnProperty(meta)
            ? metas[meta](values)
            : m;
      }
    );
  },

  /**
   * Always returns the same value unless this is an object of some sort or this
   * is a formula string.
   * @see https://docs.sheetjs.com/
   */
  parseXLSXValue(value: any) {
    let typeName;
    if (value instanceof Date || (typeName = typeof value) === 'bigint' || typeName === 'number') {
      return value;
    }
    value = [value] + '';
    return value[0] === '='
      ? {f: value.slice(1)}
      // Makes sure that numbers are represented correctly.
      : /^-?(?:[1-9]\d*|0)(?:\.\d+)?$/.test(value)
        ? +value
        : value;
  }
};
