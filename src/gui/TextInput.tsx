import './TextInput.scss';

import * as Inferno from 'inferno';

import * as utils from '../utils';

export interface TextAreaGuiProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  style?: CSSProperties;
}

// Fun fact: this component is a partial port of
// <https://github.com/uisky/notabenoid/blob/0840a9dd1932f6d254a1c9a022b77fc478afadc4/www/js/jquery.elastic.mod.js>.
// Indeed, the JQuery plugin used in Notabenoid. Also see
// <https://github.com/Andarist/react-textarea-autosize/tree/58c9807645dceb9034b733d9cb63aa66df2364b0/src>.
export class TextAreaGui extends Inferno.Component<TextAreaGuiProps, unknown> {
  public static HIDDEN_TEXT_AREA_STYLES = {
    position: 'absolute',
    'min-height': '0',
    'max-height': 'none',
    height: '0',
    overflow: 'hidden',
    resize: 'none',
    visibility: 'hidden',
    'z-index': '-1000',
  } as const;

  public static MIMICKED_STYLES = [
    // layout
    'box-sizing',
    'width',
    'border-bottom-width',
    'border-left-width',
    'border-right-width',
    'border-top-width',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'padding-top',

    // font and text
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'letter-spacing',
    'line-height',
    'tab-size',
    'text-indent',
    'text-rendering',
    'text-transform',
    'word-wrap',
    'white-space',
  ] as const;

  public static hidden_text_area: HTMLTextAreaElement | null = null;
  public static ensure_hidden_text_area(): HTMLTextAreaElement {
    if (this.hidden_text_area == null) {
      this.hidden_text_area = document.createElement('textarea');
      this.hidden_text_area.tabIndex = -1;
      this.hidden_text_area.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.hidden_text_area);
    }
    return this.hidden_text_area;
  }

  public ref = Inferno.createRef<HTMLTextAreaElement>();

  public componentDidMount(): void {
    let element = this.ref.current;
    utils.assert(element != null);
    element.addEventListener('input', this.update_size);
    window.addEventListener('resize', this.update_size);

    this.update_size();
  }

  public componentDidUpdate(): void {
    this.update_size();
  }

  public componentWillUnmount(): void {
    let element = this.ref.current;
    utils.assert(element != null);
    element.removeEventListener('input', this.update_size);
    window.removeEventListener('resize', this.update_size);
  }

  public update_size = (): void => {
    let real = this.ref.current;
    utils.assert(real != null);
    let hidden = TextAreaGui.ensure_hidden_text_area();

    let real_style = window.getComputedStyle(real);
    // Here's a constant to prevent typos.
    const IMPORTANT = 'important';

    // This idea was taken from
    // <https://github.com/jackmoore/autosize/blob/d32047a7c06d81fedb12e0e9bfdd108e3a0a68f1/src/autosize.js#L50-L54>
    if (real_style.getPropertyValue('resize') === 'both') {
      hidden.style.setProperty('resize', 'horizontal', IMPORTANT);
    } else {
      hidden.style.setProperty('resize', 'none', IMPORTANT);
    }

    for (let k of TextAreaGui.MIMICKED_STYLES) {
      hidden.style.setProperty(k, real_style.getPropertyValue(k), IMPORTANT);
    }
    for (let [k, v] of Object.entries(TextAreaGui.HIDDEN_TEXT_AREA_STYLES)) {
      hidden.style.setProperty(k, v, IMPORTANT);
    }

    let total_padding_size =
      parseFloat(real_style.paddingBottom) + parseFloat(real_style.paddingTop);
    let total_border_size =
      parseFloat(real_style.borderBottomWidth) + parseFloat(real_style.borderTopWidth);

    const ROW_MEASURING_TEXT = '\u00A0'; // non-breaking whitespace
    hidden.value = ROW_MEASURING_TEXT;
    let row_height = hidden.scrollHeight - total_padding_size;
    let min_rows = this.props.rows ?? 2; // 2 is the browser default
    // TODO: max_rows?

    hidden.value = real.value || real.placeholder || ROW_MEASURING_TEXT;
    let height = hidden.scrollHeight;
    height = Math.max(height, min_rows * row_height + total_padding_size);
    if (real_style.boxSizing === 'border-box') {
      height += total_border_size;
    } else if (real_style.boxSizing === 'content-box') {
      height -= total_padding_size;
    } else {
      // what?
    }

    real.style.setProperty('height', `${height}px`, IMPORTANT);
  };

  public render(): JSX.Element {
    return (
      <textarea
        {...this.props}
        ref={this.ref}
        style={{ ...this.props.style, overflow: 'hidden' }}
      />
    );
  }
}
