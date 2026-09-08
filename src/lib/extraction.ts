import type { Category, ExtractionResult, LineItem, TransactionType } from '@/types';

const VENDOR_PATTERNS: Record<string, { category: string; subcategory: string; items: { description: string; amount: number }[]; paymentMethod: string }> = {
  'starbucks': {
    category: 'Meals & Dining',
    subcategory: 'Coffee',
    items: [
      { description: 'Caffè Latte Venti', amount: 5.75 },
      { description: 'Bacon Gouda Sandwich', amount: 4.95 },
    ],
    paymentMethod: 'Visa',
  },
  'whole foods': {
    category: 'Meals & Dining',
    subcategory: 'Groceries',
    items: [
      { description: 'Organic Bananas', amount: 2.99 },
      { description: 'Almond Milk', amount: 4.49 },
      { description: 'Sourdough Bread', amount: 5.99 },
    ],
    paymentMethod: 'Mastercard',
  },
  'uber': {
    category: 'Travel',
    subcategory: 'Rideshare',
    items: [
      { description: 'UberX Trip', amount: 18.5 },
    ],
    paymentMethod: 'Visa',
  },
  'amazon': {
    category: 'Office Supplies',
    subcategory: 'Equipment',
    items: [
      { description: 'USB-C Hub', amount: 34.99 },
      { description: 'Wireless Mouse', amount: 29.99 },
    ],
    paymentMethod: 'Visa',
  },
  'aws': {
    category: 'Software & SaaS',
    subcategory: 'Cloud Services',
    items: [
      { description: 'EC2 t3.medium', amount: 142.37 },
      { description: 'S3 Storage', amount: 12.84 },
    ],
    paymentMethod: 'Visa',
  },
  'adobe': {
    category: 'Software & SaaS',
    subcategory: 'Subscriptions',
    items: [
      { description: 'Creative Cloud All Apps', amount: 59.99 },
    ],
    paymentMethod: 'Visa',
  },
  'home depot': {
    category: 'Office Supplies',
    subcategory: 'Equipment',
    items: [
      { description: 'LED Desk Lamp', amount: 39.97 },
      { description: 'Shelf Brackets', amount: 12.48 },
    ],
    paymentMethod: 'Mastercard',
  },
  'shell': {
    category: 'Travel',
    subcategory: 'Fuel',
    items: [
      { description: 'Unleaded 87 - 12.3 gal', amount: 44.28 },
    ],
    paymentMethod: 'Visa',
  },
  'delta': {
    category: 'Travel',
    subcategory: 'Flights',
    items: [
      { description: 'Economy SFO→JFK', amount: 312.0 },
    ],
    paymentMethod: 'Amex',
  },
  'marriott': {
    category: 'Travel',
    subcategory: 'Hotels',
    items: [
      { description: 'King Room - 2 nights', amount: 358.0 },
      { description: 'Room Tax', amount: 42.96 },
    ],
    paymentMethod: 'Amex',
  },
  'comcast': {
    category: 'Utilities',
    subcategory: 'Internet',
    items: [
      { description: 'Business Internet 400Mbps', amount: 129.0 },
    ],
    paymentMethod: 'ACH',
  },
  'slack': {
    category: 'Software & SaaS',
    subcategory: 'Subscriptions',
    items: [
      { description: 'Pro Plan - 5 users', amount: 37.5 },
    ],
    paymentMethod: 'Visa',
  },
  'google': {
    category: 'Software & SaaS',
    subcategory: 'Cloud Services',
    items: [
      { description: 'Google Workspace Business', amount: 72.0 },
    ],
    paymentMethod: 'Visa',
  },
  'target': {
    category: 'Office Supplies',
    subcategory: 'Stationery',
    items: [
      { description: 'Notebooks 3-pack', amount: 14.99 },
      { description: 'Ballpoint Pens', amount: 8.49 },
    ],
    paymentMethod: 'Mastercard',
  },
  'chipotle': {
    category: 'Meals & Dining',
    subcategory: 'Restaurants',
    items: [
      { description: 'Chicken Bowl', amount: 11.45 },
      { description: 'Chips & Guac', amount: 4.75 },
    ],
    paymentMethod: 'Visa',
  },
  'mpesa': {
    category: 'Utilities',
    subcategory: 'Phone',
    items: [
      { description: 'M-Pesa Transfer', amount: 500 },
    ],
    paymentMethod: 'M-Pesa',
  },
  'paypal': {
    category: 'Software & SaaS',
    subcategory: 'Subscriptions',
    items: [
      { description: 'Payment Received', amount: 250 },
    ],
    paymentMethod: 'PayPal',
  },
  'venmo': {
    category: 'Income',
    subcategory: 'Services',
    items: [
      { description: 'Payment Received', amount: 150 },
    ],
    paymentMethod: 'Venmo',
  },
  'cashapp': {
    category: 'Income',
    subcategory: 'Services',
    items: [
      { description: 'Payment Received', amount: 200 },
    ],
    paymentMethod: 'Cash App',
  },
};

const INCOME_KEYWORDS = ['payment received', 'invoice paid', 'deposit', 'salary', 'refund', 'income', 'venmo', 'cashapp', 'paypal received'];

const MOBILE_MONEY_KEYWORDS = ['mpesa', 'm-pesa', 'mobile money', 'airtel money', 'mtn money', 'orange money', 'wave', 'tigopesa'];

const GENERIC_VENDORS = [
  'Corner Cafe', 'City Market', 'Tech Store', 'Office Plus', 'Print Shop',
  'Local Diner', 'Gas Station', 'Bookstore', 'Pharmacy', 'Hardware Store',
];

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

export function computeFileHash(data: string): string {
  return hashString(data.substring(0, 5000));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function detectTransactionType(fileName: string, receiptType: TransactionType): TransactionType {
  if (receiptType !== 'expense') return receiptType;
  const lower = fileName.toLowerCase();
  for (const kw of INCOME_KEYWORDS) {
    if (lower.includes(kw)) return 'income';
  }
  return 'expense';
}

function isMobileMoneyReceipt(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return MOBILE_MONEY_KEYWORDS.some((kw) => lower.includes(kw));
}

function pickCategoryFromUser(categories: Category[], type: TransactionType): { name: string; subcategory: string } {
  const filtered = categories.filter((c) =>
    type === 'income' ? c.type === 'income' : c.type !== 'income'
  );
  if (filtered.length === 0) {
    return { name: type === 'income' ? 'Income' : 'Office Supplies', subcategory: '' };
  }
  const cat = pickRandom(filtered);
  const subs = cat.subcategories || [];
  return { name: cat.name, subcategory: subs.length > 0 ? pickRandom(subs) : '' };
}

function generateGenericReceipt(
  categories: Category[],
  userCurrency: string,
  receiptType: TransactionType
): ExtractionResult {
  const vendor = pickRandom(GENERIC_VENDORS);
  const itemCount = 1 + Math.floor(Math.random() * 3);
  const lineItems: LineItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    lineItems.push({
      description: `Item ${i + 1}`,
      quantity: 1,
      amount: randomAmount(5, 50),
    });
  }
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const catPick = pickCategoryFromUser(categories, receiptType);

  return {
    vendor,
    transaction_date: new Date().toISOString().split('T')[0],
    line_items: lineItems,
    subtotal,
    tax,
    tip: 0,
    total,
    payment_method: pickRandom(['Visa', 'Mastercard', 'Amex', 'M-Pesa', 'Cash']),
    currency: userCurrency,
    confidence_score: 0.55 + Math.random() * 0.4,
    category_name: catPick.name,
    subcategory: catPick.subcategory,
    transaction_type: receiptType,
  };
}

export async function extractReceiptData(
  fileName: string,
  categories: Category[],
  userCurrency: string,
  receiptType: TransactionType
): Promise<ExtractionResult> {
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));

  const detectedType = detectTransactionType(fileName, receiptType);
  const mobileMoney = isMobileMoneyReceipt(fileName);
  const lowerName = fileName.toLowerCase();
  let matchedKey: string | null = null;

  for (const key of Object.keys(VENDOR_PATTERNS)) {
    if (lowerName.includes(key)) {
      matchedKey = key;
      break;
    }
  }

  if (matchedKey) {
    const pattern = VENDOR_PATTERNS[matchedKey];
    const vendorName = matchedKey.charAt(0).toUpperCase() + matchedKey.slice(1);
    const lineItems: LineItem[] = pattern.items.map((item) => ({
      description: item.description,
      quantity: 1,
      amount: item.amount,
    }));
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = Math.round(subtotal * 0.0875 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const type = INCOME_KEYWORDS.some((kw) => lowerName.includes(kw)) ? 'income' : detectedType;

    let categoryName = pattern.category;
    let subcategory = pattern.subcategory;

    const userCat = categories.find((c) => c.name === categoryName);
    if (userCat && userCat.subcategories.length > 0 && !userCat.subcategories.includes(subcategory)) {
      subcategory = userCat.subcategories[0];
    }
    if (!userCat && type === 'income') {
      categoryName = 'Income';
      const incomeCat = categories.find((c) => c.type === 'income');
      if (incomeCat) {
        categoryName = incomeCat.name;
        subcategory = incomeCat.subcategories[0] || '';
      }
    }

    return {
      vendor: vendorName,
      transaction_date: new Date().toISOString().split('T')[0],
      line_items: lineItems,
      subtotal,
      tax,
      tip: 0,
      total,
      payment_method: mobileMoney ? pattern.paymentMethod : pattern.paymentMethod,
      currency: userCurrency,
      confidence_score: 0.85 + Math.random() * 0.14,
      category_name: categoryName,
      subcategory,
      transaction_type: type,
    };
  }

  const result = generateGenericReceipt(categories, userCurrency, detectedType);

  const matchedCategory = categories.find((c) => c.name === result.category_name);
  if (matchedCategory && matchedCategory.subcategories.length > 0) {
    if (!matchedCategory.subcategories.includes(result.subcategory)) {
      result.subcategory = matchedCategory.subcategories[0];
    }
  }

  return result;
}

export function findCategoryByName(categories: Category[], name: string): Category | null {
  return categories.find((c) => c.name === name) || null;
}
