import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

/**
 * Chapa Payment Gateway Integration
 * Ethiopian payment gateway for processing digital payments
 */

export interface ChapaPaymentRequest {
  amount: number;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  callback_url: string;
  return_url?: string;
  customization?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: Record<string, any>;
}

export interface ChapaPaymentResponse {
  status: string;
  message: string;
  data: {
    checkout_url: string;
    tx_ref: string;
  };
}

export interface ChapaVerifyResponse {
  status: string;
  message: string;
  data: {
    first_name: string;
    last_name: string;
    email: string;
    currency: string;
    amount: string;
    charge: string;
    mode: string;
    type: string;
    status: string;
    reference: string;
    tx_ref: string;
    created_at: string;
    updated_at: string;
    subaccount?: {
      id: string;
      name: string;
    };
    customer?: {
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
    payment_method?: {
      id: number;
      name: string;
      description: string;
      is_active: boolean;
      logo: string;
    };
  };
}

export interface ChapaWebhookPayload {
  event: string;
  data: {
    id: string;
    tx_ref: string;
    amount: string;
    currency: string;
    status: string;
    payment_method: string;
    created_at: string;
    customer: {
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
  };
}

export class ChapaService {
  private client: AxiosInstance;
  private secretKey: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey || config.chapaSecretKey;
    this.client = axios.create({
      baseURL: 'https://api.chapa.co/v1',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize a payment transaction
   * @param paymentRequest - Payment details
   * @returns Checkout URL and transaction reference
   */
  async initializePayment(paymentRequest: ChapaPaymentRequest): Promise<ChapaPaymentResponse> {
    try {
      const response = await this.client.post<ChapaPaymentResponse>(
        '/transaction/initialize',
        paymentRequest
      );
      return response.data;
    } catch (error: any) {
      console.error('Chapa payment initialization error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 'Failed to initialize payment with Chapa'
      );
    }
  }

  /**
   * Verify a payment transaction
   * @param txRef - Transaction reference
   * @returns Payment verification details
   */
  async verifyPayment(txRef: string): Promise<ChapaVerifyResponse> {
    try {
      const response = await this.client.get<ChapaVerifyResponse>(
        `/transaction/verify/${txRef}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Chapa payment verification error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 'Failed to verify payment with Chapa'
      );
    }
  }

  /**
   * Generate a unique transaction reference
   * @returns Transaction reference string
   */
  generateTxRef(prefix: string = 'PHARMA'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Validate webhook signature
   * @param payload - Webhook payload
   * @param signature - Signature from Chapa
   * @returns True if signature is valid
   */
  validateWebhookSignature(payload: any, signature: string): boolean {
    // Chapa uses HMAC SHA256 for webhook signature validation
    // The signature is sent in the 'Chapa-Signature' header
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', config.chapaWebhookSecret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    
    return digest === signature;
  }

  /**
   * Process webhook event
   * @param payload - Webhook payload
   * @returns Processed event data
   */
  processWebhookEvent(payload: ChapaWebhookPayload): {
    event: string;
    txRef: string;
    status: string;
    amount: number;
    currency: string;
  } {
    return {
      event: payload.event,
      txRef: payload.data.tx_ref,
      status: payload.data.status,
      amount: parseFloat(payload.data.amount),
      currency: payload.data.currency,
    };
  }

  /**
   * Check if payment is successful
   * @param verificationResponse - Verification response from Chapa
   * @returns True if payment is successful
   */
  isPaymentSuccessful(verificationResponse: ChapaVerifyResponse): boolean {
    return (
      verificationResponse.status === 'success' &&
      verificationResponse.data.status === 'success'
    );
  }
}

// Export singleton instance
export const chapaService = new ChapaService();
