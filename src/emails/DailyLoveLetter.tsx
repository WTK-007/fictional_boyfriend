import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Text,
} from '@react-email/components';

interface DailyLoveLetterProps {
  userName: string;
  loveLetter: string;
  appUrl: string;
}

export function DailyLoveLetter({ userName, loveLetter, appUrl }: DailyLoveLetterProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Text style={greetingStyle}>早安,{userName} ☀️</Text>
          <Text style={letterStyle}>{loveLetter}</Text>
          <Text style={signatureStyle}>—— 你的纸片人男友</Text>
          <Text style={footerStyle}>
            想跟我聊天?<Link href={appUrl} style={linkStyle}>点这里回来找我</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyLoveLetter;

const bodyStyle = {
  fontFamily: 'sans-serif',
  backgroundColor: '#fafafa',
  padding: '24px 0',
};

const containerStyle = {
  maxWidth: '500px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '24px',
  borderRadius: '8px',
};

const greetingStyle = {
  fontSize: '16px',
  color: '#555',
  marginBottom: '12px',
};

const letterStyle = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#222',
  whiteSpace: 'pre-wrap' as const,
};

const signatureStyle = {
  fontSize: '14px',
  color: '#666',
  marginTop: '16px',
};

const footerStyle = {
  color: '#999',
  fontSize: '12px',
  marginTop: '20px',
};

const linkStyle = {
  color: '#888',
  textDecoration: 'underline',
};
