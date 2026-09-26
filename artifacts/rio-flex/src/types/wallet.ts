export type WalletActivity = {
  id: number;
  date: string;
  station: string;
  energyKwh: number;
  cost: number;
  bonusText: string;
  event: string;
};

export type WalletLedgerEntry = {
  id: string;
  date: string;
  desc: string;
  amount: string;
  type: 'credit' | 'debit';
};
