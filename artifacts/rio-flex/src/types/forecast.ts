export type ForecastStatus = 'solar' | 'pico' | 'normal';

export type HourlyForecast = {
  hour: number;
  label: string;
  demandGw: number;
  solarGw: number;
  status: ForecastStatus;
};
