import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

/**
 * Takes or picks one photo and returns a URI that keeps working later: on the web the browser's blob
 * URL dies with the tab, so the picture is kept as a data URL; on the phone the picker's file URI is used.
 * On the web both sources open the file dialog (phones' browsers offer the camera there).
 * Returns undefined when the person cancels or refuses the permission.
 */
export async function pickPhoto(source: "camera" | "library" = "camera"): Promise<string | undefined> {
  const web = Platform.OS === "web";
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: web, allowsEditing: false };
  let result: ImagePicker.ImagePickerResult;
  if (!web && source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return undefined;
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return undefined;
  if (web && asset.base64) return `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
  return asset.uri;
}
