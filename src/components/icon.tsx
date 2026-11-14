import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'search'
  | 'sliders'
  | 'heart'
  | 'heartFill'
  | 'plus'
  | 'mail'
  | 'person'
  | 'back'
  | 'chevron'
  | 'spark'
  | 'close'
  | 'pin'
  | 'pushpin'
  | 'star'
  | 'camera'
  | 'check';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color = '#1E3A2F', strokeWidth = 1.8 }: IconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'pushpin':
      return <Svg {...common}><Path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v6" {...stroke} /></Svg>;
    case 'search':
      return (
        <Svg {...common}>
          <Circle cx="11" cy="11" r="6.25" {...stroke} />
          <Path d="M16 16.5L20.2 20.7" {...stroke} />
        </Svg>
      );
    case 'sliders':
      return (
        <Svg {...common}>
          <Path d="M4 8h16M4 16h16" {...stroke} />
          <Circle cx="9" cy="8" r="2.1" fill="#F3F0EA" {...stroke} />
          <Circle cx="15" cy="16" r="2.1" fill="#F3F0EA" {...stroke} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg {...common}>
          <Path d="M12 19.4s-6.4-3.9-6.4-8.1A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 6.4 2.7c0 4.2-6.4 8.1-6.4 8.1z" {...stroke} />
        </Svg>
      );
    case 'heartFill':
      return (
        <Svg {...common}>
          <Path d="M12 19.6s-6.6-4-6.6-8.3A3.7 3.7 0 0 1 12 8.2a3.7 3.7 0 0 1 6.6 3.1c0 4.3-6.6 8.3-6.6 8.3z" fill={color} />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...common}>
          <Path d="M12 5.5v13M5.5 12h13" {...stroke} />
        </Svg>
      );
    case 'mail':
      return (
        <Svg {...common}>
          <Rect x="3.5" y="5.5" width="17" height="13" rx="2.2" {...stroke} />
          <Path d="M4.2 7.2 12 12.4l7.8-5.2" {...stroke} />
        </Svg>
      );
    case 'person':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="8.2" r="3.1" {...stroke} />
          <Path d="M5.6 19.2c1.2-2.8 3.4-4.2 6.4-4.2s5.2 1.4 6.4 4.2" {...stroke} />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...common}>
          <Path d="M14.8 5.5 8 12l6.8 6.5" {...stroke} />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg {...common}>
          <Path d="M7 10l5 5 5-5" {...stroke} />
        </Svg>
      );
    case 'spark':
      return (
        <Svg {...common}>
          <Path d="M12 3.2 13.3 9 19 10.2 13.3 11.5 12 17.4 10.7 11.5 5 10.2 10.7 9 12 3.2z" fill={color} />
          <Path d="M18 15.2 18.5 17l1.8.5-1.8.5-.5 1.8-.5-1.8-1.8-.5 1.8-.5.5-1.8z" fill={color} />
        </Svg>
      );
    case 'close':
      return (
        <Svg {...common}>
          <Path d="M7 7l10 10M17 7 7 17" {...stroke} />
        </Svg>
      );
    case 'pin':
      return (
        <Svg {...common}>
          <Path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z" {...stroke} />
          <Circle cx="12" cy="11" r="1.7" {...stroke} />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...common}>
          <Path d="m12 4.2 1.9 4.2 4.6.5-3.4 3.1.9 4.5L12 14.3 7.9 16.5l1-4.5L5.5 8.9l4.6-.5L12 4.2z" {...stroke} />
        </Svg>
      );
    case 'camera':
      return (
        <Svg {...common}>
          <Path d="M8.2 7.2 9.4 5.5h5.2l1.2 1.7H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2h3.2z" {...stroke} />
          <Circle cx="12" cy="13" r="3" {...stroke} />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common}>
          <Path d="M5.5 12.5 10 17l8.5-9" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}
