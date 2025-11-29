import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, User, Phone, Crop, Leaf, Shield, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SignUpScreen() {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    farmerName: '',
    email: '',
    phone: '',
    landSize: '',
    soilType: '',
    otp: '',
  });
  const [showOtpField, setShowOtpField] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const otpInputRef = useRef<TextInput | null>(null);
  const [otpStatus, setOtpStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpSentTime, setOtpSentTime] = useState<string | null>(null);
  const [otpFeedback, setOtpFeedback] = useState<string | null>(null);
  const otpValidationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OTP Timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [otpTimer]);

  useEffect(() => {
    if (showOtpField) {
      otpInputRef.current?.focus();
    }
  }, [showOtpField]);

  useEffect(() => {
    if (transitioning) {
      router.replace('/(tabs)');
    }
  }, [transitioning]);

  useEffect(() => {
    return () => {
      if (otpValidationTimeout.current) {
        clearTimeout(otpValidationTimeout.current);
      }
    };
  }, []);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateOtpCode = async (otpValue: string, normalizedEmail: string) => {
    setOtpStatus('checking');
    setOtpFeedback(null);
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, otp: otpValue, validateOnly: true })
      });
      const data = await response.json();

      if (response.ok && data?.data?.valid) {
        setOtpStatus('valid');
        setOtpFeedback(t('signup.otpVerifiedSuccess', { defaultValue: 'OTP verified! You can create your account now.' }));
      } else {
        setOtpStatus('invalid');
        setOtpFeedback(data?.error?.message || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('Error validating OTP:', error);
      setOtpStatus('invalid');
      setOtpFeedback('Unable to validate OTP. Please check your internet connection.');
    }
  };

  const triggerOtpValidation = (otpValue: string) => {
    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setOtpStatus('invalid');
      setOtpFeedback('Enter a valid email before verifying the OTP.');
      return;
    }
    setFormData(prev => ({ ...prev, email: normalizedEmail }));
    validateOtpCode(otpValue, normalizedEmail);
  };

  const handleOtpInputChange = (value: string) => {
    const sanitizedValue = value.replace(/\D/g, '').slice(0, 6);
    handleInputChange('otp', sanitizedValue);
    setOtpFeedback(null);

    if (otpValidationTimeout.current) {
      clearTimeout(otpValidationTimeout.current);
      otpValidationTimeout.current = null;
    }

    if (sanitizedValue.length === 6) {
      setOtpStatus('checking');
      otpValidationTimeout.current = setTimeout(() => {
        triggerOtpValidation(sanitizedValue);
      }, 400);
    } else if (sanitizedValue.length === 0) {
      setOtpStatus('idle');
    } else {
      setOtpStatus('idle');
    }
  };

  const handleSendOTP = async () => {
    setErrorMessage(null);
    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      Alert.alert(t('error'), 'Please enter a valid email address');
      return;
    }
    setFormData(prev => ({ ...prev, email: normalizedEmail }));
    setOtpLoading(true);
    setOtpStatus('idle');
    setOtpFeedback(null);
    
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${BACKEND_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, isLogin: false })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setFormData(prev => ({ ...prev, otp: '' }));
        setShowOtpField(true);
        setOtpTimer(300); // 5 minutes
        const now = new Date();
        setOtpSentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        Alert.alert(
          '\u2705 OTP Sent Successfully',
          `A 6-digit verification code has been sent to:\\n\\n${normalizedEmail}\\n\\nPlease check your inbox and spam folder.\\n\\nValid for 5 minutes.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        // Check if user already exists
        if (response.status === 409 || data.error?.code === 'USER_EXISTS') {
          Alert.alert(
            '\u26a0\ufe0f Account Already Exists', 
            `An account is already registered with:\\n\\n${normalizedEmail}\\n\\nWould you like to login instead?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: '\ud83d\udd11 Login', onPress: () => router.push('/auth/login') }
            ]
          );
        } else {
          Alert.alert(t('error'), data.error?.message || 'Failed to send OTP');
        }
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert(t('error'), 'Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!formData.farmerName.trim()) { Alert.alert(t('error'), t('nameRequired')); return; }
    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!normalizedEmail) { Alert.alert(t('error'), 'Email is required'); return; }
    if (!normalizedEmail.includes('@')) { Alert.alert(t('error'), 'Please enter a valid email address'); return; }
    setFormData(prev => ({ ...prev, email: normalizedEmail }));
    const phoneValue = formData.phone.trim();
    if (!phoneValue) { Alert.alert(t('error'), 'Phone number is required'); return; }
    const normalizedPhone = phoneValue.replace(/\D/g, '');
    if (normalizedPhone.length < 6) { Alert.alert(t('error'), 'Please enter a valid phone number'); return; }
    if (!showOtpField) { Alert.alert(t('error'), t('signup.sendOtpFirst')); return; }
    if (!formData.otp.trim()) { Alert.alert(t('error'), t('enterOTP')); return; }
    if (otpStatus !== 'valid') { Alert.alert(t('error'), 'Please enter a valid OTP before creating your account.'); return; }
    
    setLoading(true);
    setVerifying(true);
    
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          otp: formData.otp,
          name: formData.farmerName,
          phone: phoneValue,
          landSize: formData.landSize,
          soilType: formData.soilType,
          language: i18n.language,
          isLogin: false
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('🔍 Signup response data:', JSON.stringify(data, null, 2));
        const userPayload = data?.user || data?.data?.user || null;
        const sessionToken = data?.token || data?.session?.token || null;
        console.log('🔍 userPayload to be saved:', JSON.stringify(userPayload, null, 2));

        if (userPayload) {
          await AsyncStorage.setItem('userData', JSON.stringify(userPayload));
        }
        if (sessionToken) {
          await AsyncStorage.setItem('authToken', sessionToken);
        } else {
          await AsyncStorage.removeItem('authToken');
        }

        setVerifying(false);
        setLoading(false);
        Alert.alert(t('success'), 'Registration successful! Welcome to KrushiMitra.');
        setTransitioning(true);
      } else {
        setVerifying(false);
        setLoading(false);
        // Check if user already exists
        if (response.status === 409 || data.error?.code === 'USER_EXISTS') {
          Alert.alert(
            '\u26a0\ufe0f Account Already Exists', 
            `An account is already registered with:\\n\\n${normalizedEmail}\\n\\nWould you like to login instead?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: '\ud83d\udd11 Login', onPress: () => router.push('/auth/login') }
            ]
          );
        } else {
          Alert.alert(t('error'), data.error?.message || 'OTP verification failed');
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setVerifying(false);
      setLoading(false);
      Alert.alert(t('error'), 'Network error. Please try again.');
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F1F8E9', '#E8F5E8']}
          style={styles.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.3 }}
        >
          {/* Top Navigation */}
          <View style={styles.topNavigation}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color="#4CAF50" />
            </TouchableOpacity>
            
            <View style={styles.topCenter}>
              <Text style={styles.topTitle}>{t('signup.title')}</Text>
            </View>
            
            <View style={styles.topPlaceholder} />
          </View>
          
          {/* Top Section - Logo */}
          <View style={styles.topSection}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#4CAF50', '#2E7D32', '#4CAF50']}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.logoWrapper}>
                  <Image 
                    source={require('../logoai.jpg')} 
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </LinearGradient>
              
              {/* Glow Effect */}
              <View style={styles.glowEffect} />
            </View>
            
            <Text style={styles.headerTitle}>{t('signup.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('signup.fillFarmingDetails')}</Text>
          </View>

          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Form Fields */}
            <View style={styles.formContainer}>
              
              {/* Farmer Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('name').toUpperCase()} *</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'farmerName' && styles.inputContainerFocused
                ]}>
                  <View style={styles.inputIconContainer}>
                    <User size={20} color={focusedField === 'farmerName' ? '#2E7D32' : '#4CAF50'} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder={t('enterName')}
                    placeholderTextColor="#999"
                    value={formData.farmerName}
                    onChangeText={(value) => handleInputChange('farmerName', value)}
                    onFocus={() => setFocusedField('farmerName')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Email with Send OTP */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL *</Text>
                <View style={styles.otpGroupContainer}>
                  <View style={[
                    styles.emailInputWrapper,
                    focusedField === 'email' && styles.inputContainerFocused
                  ]}>
                    <View style={styles.inputIconContainer}>
                      <User size={20} color={focusedField === 'email' ? '#2E7D32' : '#4CAF50'} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      value={formData.email}
                      onChangeText={(value) => handleInputChange('email', value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.otpButton,
                      (!formData.email || !formData.email.includes('@') || otpLoading) && styles.otpButtonDisabled
                    ]}
                    onPress={handleSendOTP}
                    disabled={!formData.email || !formData.email.includes('@') || otpLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.otpButtonText}>
                      {otpLoading ? t('loading') : t('getOTP')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>We'll send a verification code to this email</Text>
              </View>

              {/* Phone Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PHONE *</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'phone' && styles.inputContainerFocused
                ]}>
                  <View style={styles.inputIconContainer}>
                    <Phone size={20} color={focusedField === 'phone' ? '#2E7D32' : '#4CAF50'} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    placeholderTextColor="#999"
                    value={formData.phone}
                    onChangeText={(value) => handleInputChange('phone', value)}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>
                <Text style={styles.helperText}>Used only for OTP verification</Text>
              </View>

              {/* Land Size */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{`${t('signup.landSize').toUpperCase()} (OPTIONAL)`}</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'landSize' && styles.inputContainerFocused
                ]}>
                  <View style={styles.inputIconContainer}>
                    <Crop size={20} color={focusedField === 'landSize' ? '#2E7D32' : '#4CAF50'} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder={t('signup.enterLandSize')}
                    placeholderTextColor="#999"
                    value={formData.landSize}
                    onChangeText={(value) => handleInputChange('landSize', value)}
                    onFocus={() => setFocusedField('landSize')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                <Text style={styles.helperText}>Helps us suggest better crop plans for you</Text>
              </View>

              {/* Soil Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{`${t('signup.soilType').toUpperCase()} (OPTIONAL)`}</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'soilType' && styles.inputContainerFocused
                ]}>
                  <View style={styles.inputIconContainer}>
                    <Leaf size={20} color={focusedField === 'soilType' ? '#2E7D32' : '#4CAF50'} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder={t('signup.enterSoilType')}
                    placeholderTextColor="#999"
                    value={formData.soilType}
                    onChangeText={(value) => handleInputChange('soilType', value)}
                    onFocus={() => setFocusedField('soilType')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                  />
                </View>
                <Text style={styles.helperText}>Optional — improves personalized recommendations</Text>
              </View>

              {/* OTP Field */}
              {showOtpField && (
                <View style={styles.inputGroup}>
                  <View style={styles.otpHeader}>
                    <Text style={styles.inputLabel}>{t('enterOTP').toUpperCase()} *</Text>
                    {otpSentTime && (
                      <Text style={styles.otpSentTime}>Sent at {otpSentTime}</Text>
                    )}
                  </View>
                  <View style={[
                    styles.inputContainer,
                    focusedField === 'otp' && styles.inputContainerFocused,
                    otpStatus === 'valid' && styles.inputContainerSuccess,
                    otpStatus === 'invalid' && styles.inputContainerError
                  ]}>
                    <View style={styles.inputIconContainer}>
                      <Shield size={20} color={focusedField === 'otp' ? '#2E7D32' : '#4CAF50'} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="#999"
                      value={formData.otp}
                      onChangeText={handleOtpInputChange}
                      onFocus={() => setFocusedField('otp')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="numeric"
                      maxLength={6}
                      autoComplete="sms-otp"
                      textContentType="oneTimeCode"
                      ref={otpInputRef}
                    />
                  </View>
                  
                  {/* OTP Status Messages */}
                  {otpStatus === 'valid' && (
                    <Text style={styles.otpStatusSuccess}>✓ {otpFeedback || 'OTP verified successfully.'}</Text>
                  )}
                  {otpStatus === 'invalid' && otpFeedback && (
                    <Text style={styles.otpStatusError}>✗ {otpFeedback}</Text>
                  )}
                  {otpStatus === 'checking' && (
                    <Text style={styles.otpStatusChecking}>⏳ {t('loading')}</Text>
                  )}
                  
                  {/* OTP Timer and Resend */}
                  <View style={styles.otpFooter}>
                    {otpTimer > 0 ? (
                      <View style={styles.timerContainer}>
                        <Text style={styles.timerText}>
                          ⏱️ Code expires in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={styles.resendButton}
                        onPress={handleSendOtp}
                        disabled={otpLoading}
                      >
                        <Text style={styles.resendText}>
                          {otpLoading ? 'Sending...' : '🔄 Resend OTP'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.otpHint}>Check spam folder if not received</Text>
                  </View>
                </View>
              )}
              {errorMessage && (
                <Text style={{ color: '#d32f2f', marginTop: -12, marginBottom: 24, fontSize: 13 }}>{errorMessage}</Text>
              )}
            </View>
          </ScrollView>

          {/* Bottom Section - Submit Button */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || verifying || !formData.farmerName || !formData.email || !formData.phone || 
                 !showOtpField || !formData.otp || otpStatus !== 'valid') && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={
                loading || verifying || !formData.farmerName || !formData.email || !formData.phone || 
                !showOtpField || !formData.otp || otpStatus !== 'valid'
              }
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>
                {verifying ? t('verifyOTP') : loading ? t('loading') : t('signup.createAccount').toUpperCase()}
              </Text>
            </TouchableOpacity>
            
            {/* Login Link */}
            <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.loginContainer}>
              <Text style={styles.loginText}>
                {t('alreadyHaveAccount')} <Text style={styles.loginLink}>{t('login')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundGradient: {
    flex: 1,
  },
  
  // Top Navigation
  topNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  topPlaceholder: {
    width: 40,
  },
  
  // Top Section
  topSection: {
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 15,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  glowEffect: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    opacity: 0.4,
    zIndex: -1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // Form Section
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#757575',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputContainerFocused: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  inputContainerSuccess: {
    borderColor: '#2E7D32',
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: '#d32f2f',
    borderWidth: 2,
  },
  otpGroupContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  emailInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  phoneInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIconContainer: {
    marginRight: 10,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  otpButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#2E7D32',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  otpButtonDisabled: {
    backgroundColor: '#A5D6A7',
    shadowOpacity: 0.1,
  },
  otpButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  helperText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontStyle: 'italic',
  },
  otpStatusSuccess: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '600',
  },
  otpStatusError: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '600',
  },
  otpStatusChecking: {
    fontSize: 12,
    color: '#757575',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // OTP Enhancement Styles
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  otpSentTime: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  otpFooter: {
    marginTop: 12,
    gap: 8,
  },
  timerContainer: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  timerText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  resendButton: {
    backgroundColor: '#F1F8E9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5E1A5',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  otpHint: {
    fontSize: 11,
    color: '#757575',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // Bottom Section
  bottomSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2E7D32',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  loginContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginText: {
    fontSize: 14,
    color: '#757575',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  loginLink: {
    color: '#4CAF50',
    fontWeight: '700',
  },
});