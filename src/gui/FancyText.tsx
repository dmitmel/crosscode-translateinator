import * as crosscode_markup from '../crosscode_markup';
import * as gui from '../gui';

export const WHITESPACE_COLOR = '#666666';
export const SPECIAL_ESCAPES_COLOR = '#66ccdd';
export const NEWLINE_ICON_CHAR = '↵';

export interface FancyTextGuiProps {
  highlight_crosscode_markup?: boolean;
  highlight_newlines?: boolean;
  // TODO: highlight leading/trailing whitespace
  children: string;
}

export function FancyTextGui(props: gui.ComponentProps<FancyTextGuiProps>): JSX.Element {
  let source_text = props.children;
  let token_elements: JSX.Element[] = [];

  let tokens_iterable: Iterable<crosscode_markup.Token> = props.highlight_crosscode_markup
    ? crosscode_markup.lex(source_text)
    : [
        {
          type: 'LITERAL_TEXT',
          start_index: 0,
          end_index: source_text.length,
          data: source_text,
        },
      ];

  let current_color: string | null | undefined = null;
  let prev_token_end_index = 0;
  for (let token of tokens_iterable) {
    if (token.start_index !== prev_token_end_index) {
      throw new Error(
        `Detected a bug in the lexer: the start index of a token (${token.start_index}) doesn't match the end index of a previous token (${prev_token_end_index})`,
      );
    }

    if (token.type === 'COLOR') {
      current_color = crosscode_markup.FONT_COLORS.get(token.data);
    }

    let token_style: CSSProperties = {};
    let token_color = token.type === 'LITERAL_TEXT' ? current_color : SPECIAL_ESCAPES_COLOR;
    if (token_color != null) token_style.color = token_color;

    let token_key = `token;${token.type};${token.start_index};${token.end_index}`;

    let text_slice = source_text.slice(token.start_index, token.end_index);
    let text_elements: Array<JSX.Element | string> = [];

    if (props.highlight_newlines) {
      let line_start_index = 0;
      while (true) {
        let newline_index = text_slice.indexOf('\n', line_start_index);
        if (newline_index < 0) break;

        text_elements.push(
          text_slice.slice(line_start_index, newline_index),
          <span
            key={`${token_key};whitespace;${newline_index}`}
            className="IconlikeText"
            style={{ ...token_style, border: '1px solid currentColor', color: WHITESPACE_COLOR }}>
            {NEWLINE_ICON_CHAR}
          </span>,
          '\n',
        );
        line_start_index = newline_index + 1;
      }
      text_elements.push(text_slice.slice(line_start_index));
    } else {
      text_elements.push(text_slice);
    }

    token_elements.push(
      <span key={token_key} style={token_style}>
        {text_elements}
      </span>,
    );

    prev_token_end_index = token.end_index;
  }
  if (prev_token_end_index !== source_text.length) {
    throw new Error(
      `Detected a bug in the lexer: the end index of the last token (${prev_token_end_index}) doesn't match the length of the source text (${source_text.length})`,
    );
  }

  return <>{token_elements}</>;
}
