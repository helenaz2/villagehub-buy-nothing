import Svg, { Circle, Path } from 'react-native-svg';

// Vector interpretation of the supplied house-and-person reference.
export function VillageLogo() {
  return <Svg width="100%" height="100%" viewBox="0 0 1000 1000" accessibilityRole="image" accessibilityLabel="VillageHub logo: a green home surrounding a golden person">
    <Path d="M200 278 194 174M190 174 151 88H343L334 174Z" fill="none" stroke="#507500" strokeWidth={29} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M32 602 148 320 478 80 514 82 838 320 952 596 822 596 734 882 207 882 143 602Z" fill="none" stroke="#507500" strokeWidth={29} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M143 602 227 389 489 201 732 377 822 596" fill="none" stroke="#507500" strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M520 280C549 420 538 517 488 581C432 627 390 548 363 474C371 557 394 611 425 667C453 719 469 770 475 824C488 747 508 712 526 660C572 528 566 410 520 280Z" fill="#EBA22E" stroke="#EBA22E" strokeWidth={2} strokeLinejoin="round" />
    <Circle cx={451} cy={514} r={37} fill="#EBA22E" />
  </Svg>;
}
