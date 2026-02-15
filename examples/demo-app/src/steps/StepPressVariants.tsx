import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  Button,
  Image,
  ScrollView,
} from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepPressVariants({ isDarkMode }: StepProps) {
  const [touchableOpacityTaps, setTouchableOpacityTaps] = React.useState(0);
  const [touchableHighlightTaps, setTouchableHighlightTaps] = React.useState(0);
  const [rnButtonTaps, setRnButtonTaps] = React.useState(0);
  const [imageOnlyTaps, setImageOnlyTaps] = React.useState(0);
  const [iconLabelTaps, setIconLabelTaps] = React.useState(0);
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID="press-screen-scroll"
      >
        <TouchableOpacity
          style={[styles.button, styles.buttonTouchableOpacity]}
          onPress={() => setTouchableOpacityTaps((n) => n + 1)}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>TouchableOpacity ({touchableOpacityTaps})</Text>
        </TouchableOpacity>
        <TouchableHighlight
          style={[styles.button, styles.buttonTouchableHighlight]}
          onPress={() => setTouchableHighlightTaps((n) => n + 1)}
          underlayColor="#6a8"
        >
          <Text style={styles.buttonText}>TouchableHighlight ({touchableHighlightTaps})</Text>
        </TouchableHighlight>
        <View style={styles.buttonWrapper}>
          <Button
            title={`RN Button (${rnButtonTaps})`}
            onPress={() => setRnButtonTaps((n) => n + 1)}
          />
        </View>
        <Pressable
          style={[styles.button, styles.buttonImageOnly]}
          onPress={() => setImageOnlyTaps((n) => n + 1)}
          accessibilityLabel={`Image only button (${imageOnlyTaps})`}
        >
          <Image
            source={{ uri: 'https://via.placeholder.com/24x24/648/fff?text=+' }}
            style={styles.iconImage}
            accessibilityLabel="Image only button"
          />
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonIconLabel]}
          onPress={() => setIconLabelTaps((n) => n + 1)}
        >
          <Image
            source={{ uri: 'https://via.placeholder.com/20x20/486/fff?text=+' }}
            style={styles.iconImageSmall}
          />
          <Text style={styles.buttonText}>Icon + Label ({iconLabelTaps})</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonTouchableOpacity: { backgroundColor: '#648' },
  buttonTouchableHighlight: { backgroundColor: '#486' },
  buttonImageOnly: { backgroundColor: '#846', padding: 12 },
  buttonIconLabel: { backgroundColor: '#684', flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonWrapper: { marginTop: 8 },
  iconImage: { width: 24, height: 24 },
  iconImageSmall: { width: 20, height: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
