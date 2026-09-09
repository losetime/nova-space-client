import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'nova-space-secret-key-2024',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  database: {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'nova_space',
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@nova-space.com',
  },
  satellite: {
    broadcastInterval:
      parseInt(process.env.SATELLITE_BROADCAST_INTERVAL || '5000', 10) || 5000,
  },
  esaDiscos: {
    apiToken: process.env.ESA_DISCOS_API_TOKEN || '',
    baseUrl: 'https://discosweb.esoc.esa.int/api',
  },
}));
