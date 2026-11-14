export const CATEGORIES = ['Furniture', 'Clothing', 'Home', 'Other'] as const;
export const CONDITIONS = ['Like new', 'Good condition', 'Fair', 'Well loved'] as const;
export const COLORS = ['Natural', 'Sage', 'Cream', 'Black', 'White', 'Terracotta', 'Oak'] as const;
export const SIZES = ['One size', 'Small', 'Medium', 'Large'] as const;

// Categories can also be supplied by the shared backend catalog.
export type Category = string;
export type Condition = (typeof CONDITIONS)[number];

export type Item = {
  id: string;
  title: string;
  description: string;
  photos: string[];
  size: string;
  color: string;
  condition: Condition;
  conditionNote: string;
  category: Category;
  tags: string[];
  features: string[];
  materials: string;
  fabric: string;
  neighborhood: string;
  city: string;
  distance: string;
  hostId: string;
  status: 'available' | 'claimed';
  postedLabel: string;
  saves: number;
};

export type Person = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  neighborhood: string;
  city: string;
  bio: string;
  rating: number;
  memberSince: string;
  monthsHere: number;
};

export type ChatMessage = {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  sentAt?: number;
};

export type Conversation = {
  id: string;
  itemId: string;
  messages: ChatMessage[];
  unread: boolean;
  pinned?: boolean;
  participantId?: string;
  ratings?: Record<string, number>;
  // Backend integration: earliest rating invitation time after confirmed conversation end.
  ratingAvailableAt?: number;
  ratingDismissedBy?: string[];
};

export type Draft = {
  title: string;
  description: string;
  photos: string[];
  size: string;
  color: string;
  condition: Condition | '';
  conditionNote: string;
  category: Category | '';
  tags: string[];
  features: string[];
  materials: string;
  fabric: string;
  location: string;
};
