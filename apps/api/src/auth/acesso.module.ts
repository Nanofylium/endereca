import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CONFIG, Config } from '../config';
import { AcessoController } from './acesso.controller';
import { AcessoService } from './acesso.service';
import { SessaoGuard } from './sessao.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [CONFIG],
      // Sessão de um turno de trabalho.
      useFactory: (config: Config) => ({ secret: config.jwtSecret, signOptions: { expiresIn: '9h' } }),
    }),
  ],
  controllers: [AcessoController],
  providers: [AcessoService, SessaoGuard],
  exports: [JwtModule, SessaoGuard],
})
export class AcessoModule {}
