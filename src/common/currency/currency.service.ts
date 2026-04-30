import { Injectable, Logger } from '@nestjs/common';
import { Country } from 'country-state-city';
import { Convert } from 'easy-currencies';

interface CurrencyMapping {
  [key: string]: string;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  // Comprehensive country to currency mapping
  private readonly currencyMap: CurrencyMapping = {
    US: 'USD',
    AU: 'AUD',
    GB: 'GBP',
    CA: 'CAD',
    NZ: 'NZD',
    IN: 'INR',
    CN: 'CNY',
    JP: 'JPY',
    SG: 'SGD',
    MY: 'MYR',
    TH: 'THB',
    PH: 'PHP',
    ID: 'IDR',
    VN: 'VND',
    KR: 'KRW',
    HK: 'HKD',
    TW: 'TWD',
    AE: 'AED',
    SA: 'SAR',
    ZA: 'ZAR',
    // European countries using EUR
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    NL: 'EUR',
    BE: 'EUR',
    AT: 'EUR',
    PT: 'EUR',
    IE: 'EUR',
    GR: 'EUR',
    FI: 'EUR',
    // Other currencies
    CH: 'CHF',
    SE: 'SEK',
    NO: 'NOK',
    DK: 'DKK',
    PL: 'PLN',
    CZ: 'CZK',
    HU: 'HUF',
    RO: 'RON',
    BR: 'BRL',
    MX: 'MXN',
    AR: 'ARS',
    CL: 'CLP',
    CO: 'COP',
    PE: 'PEN',
    RU: 'RUB',
    TR: 'TRY',
    EG: 'EGP',
    NG: 'NGN',
    KE: 'KES',
    IL: 'ILS',
    PK: 'PKR',
    BD: 'BDT',
    LK: 'LKR',
  };

  /**
   * Get all countries with their currencies
   */
  getAllCountries(): Array<{
    isoCode: string;
    name: string;
    currency: string;
    flag: string;
  }> {
    const countries = Country.getAllCountries();
    return countries.map((country) => ({
      isoCode: country.isoCode,
      name: country.name,
      currency: this.getCurrencyByCountryCode(country.isoCode),
      flag: country.flag,
    }));
  }

  /**
   * Get currency code by country ISO code
   */
  getCurrencyByCountryCode(countryCode: string): string {
    return this.currencyMap[countryCode] || 'AUD'; // Default to AUD
  }

  /**
   * Get country details by ISO code
   */
  getCountryByCode(countryCode: string): {
    isoCode: string;
    name: string;
    currency: string;
    flag: string;
  } | null {
    const country = Country.getCountryByCode(countryCode);
    if (!country) return null;

    return {
      isoCode: country.isoCode,
      name: country.name,
      currency: this.getCurrencyByCountryCode(country.isoCode),
      flag: country.flag,
    };
  }

  /**
   * Fetch exchange rate from source currency to AUD
   * @param fromCurrency - Source currency code (e.g., 'USD')
   * @returns Exchange rate to AUD
   */
  async getExchangeRateToAUD(fromCurrency: string): Promise<{
    rate: number;
    source: string;
    timestamp: Date;
  }> {
    // If already AUD, return 1:1
    if (fromCurrency === 'AUD') {
      return {
        rate: 1.0,
        source: 'direct',
        timestamp: new Date(),
      };
    }

    try {
      // Convert 1 unit of fromCurrency to AUD
      const result = await Convert(1).from(fromCurrency).to('AUD');

      return {
        rate: parseFloat(result.toFixed(6)),
        source: 'easy-currencies',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rate for ${fromCurrency}:`,
        error,
      );
      throw new Error(
        `Unable to fetch exchange rate for ${fromCurrency}. Please try again later.`,
      );
    }
  }

  /**
   * Convert amount from one currency to AUD
   */
  async convertToAUD(
    amount: number,
    fromCurrency: string,
  ): Promise<{
    amountInAUD: number;
    exchangeRate: number;
    source: string;
    convertedAt: Date;
  }> {
    const { rate, source, timestamp } =
      await this.getExchangeRateToAUD(fromCurrency);
    const amountInAUD = parseFloat((amount * rate).toFixed(2));

    return {
      amountInAUD,
      exchangeRate: rate,
      source,
      convertedAt: timestamp,
    };
  }

  /**
   * Search countries by name
   */
  searchCountries(query: string): Array<{
    isoCode: string;
    name: string;
    currency: string;
    flag: string;
  }> {
    const countries = this.getAllCountries();
    const lowerQuery = query.toLowerCase();
    return countries.filter((country) =>
      country.name.toLowerCase().includes(lowerQuery),
    );
  }
}
