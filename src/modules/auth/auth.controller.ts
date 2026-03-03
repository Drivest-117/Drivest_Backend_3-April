import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('v1/auth/sign-up')
  async signUp(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('auth/sign-up')
  async signUpLegacy(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('v1/auth/sign-in')
  @HttpCode(200)
  async signIn(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('auth/sign-in')
  @HttpCode(200)
  async signInLegacy(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('auth/register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
