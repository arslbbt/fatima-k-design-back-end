import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Currency')
@Controller('currency')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('countries')
  @ApiOperation({ summary: 'Get all countries with their currencies' })
  getAllCountries() {
    return this.currencyService.getAllCountries();
  }

  @Get('countries/search')
  @ApiOperation({ summary: 'Search countries by name' })
  searchCountries(@Query('q') query: string) {
    if (!query) {
      return this.currencyService.getAllCountries();
    }
    return this.currencyService.searchCountries(query);
  }

  @Get('exchange-rate')
  @ApiOperation({ summary: 'Get exchange rate to AUD' })
  async getExchangeRate(@Query('from') fromCurrency: string) {
    return this.currencyService.getExchangeRateToAUD(
      fromCurrency.toUpperCase(),
    );
  }
}
