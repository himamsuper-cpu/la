package id.noom.launcher;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "NoomAndroid")
public class NoomPlugin extends Plugin {
    private static final String PREFERENCES = "noom_launcher";
    private static final String MODS_FOLDER = "mods_folder_uri";
    private static final String TAG = "NoomLauncher";
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void openPojavLauncher(PluginCall call) {
        String[] packages = {"net.kdt.pojavlaunch", "com.movtery.zalithlauncher"};
        for (String packageName : packages) {
            Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
            if (intent != null) {
                getActivity().startActivity(intent);
                JSObject result = new JSObject();
                result.put("message", "PojavLauncher dibuka. Login dan mulai Minecraft dari aplikasi tersebut.");
                call.resolve(result);
                return;
            }
        }
        call.reject("PojavLauncher belum terpasang. Pasang PojavLauncher atau Zalith Launcher terlebih dahulu.");
    }

    @PluginMethod
    public void chooseModsFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "modsFolderSelected");
    }

    @ActivityCallback
    private void modsFolderSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Pemilihan folder dibatalkan.");
            return;
        }
        Uri folder = result.getData().getData();
        int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(folder, flags);
            getContext().getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE)
                .edit().putString(MODS_FOLDER, folder.toString()).apply();
            JSObject response = new JSObject();
            response.put("configured", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Noom tidak mendapat izin untuk folder tersebut.", error);
        }
    }

    @PluginMethod
    public void getModsFolder(PluginCall call) {
        boolean configured = getModsFolderUri() != null;
        JSObject result = new JSObject();
        result.put("configured", configured);
        call.resolve(result);
    }

    @PluginMethod
    public void installMod(PluginCall call) {
        String projectId = call.getString("projectId", "");
        String gameVersion = call.getString("version", "");
        String loader = call.getString("loader", "Fabric");
        if (!projectId.matches("[A-Za-z0-9_-]{1,64}")) {
            call.reject("ID mod tidak valid.");
            return;
        }
        if (!(gameVersion.equals("1.21.4") || gameVersion.equals("1.21.1") || gameVersion.equals("1.20.1") || gameVersion.equals("1.19.4"))) {
            call.reject("Versi Minecraft tidak didukung.");
            return;
        }
        if (!loader.equals("Fabric")) {
            call.reject("Saat ini Noom memasang mod untuk profil Fabric.");
            return;
        }
        Uri folder = getModsFolderUri();
        if (folder == null) {
            call.reject("Pilih folder mods Pojav terlebih dahulu di Pengaturan.");
            return;
        }

        downloads.execute(() -> {
            try {
                JSONObject file = findCompatibleFile(projectId, gameVersion);
                String filename = sanitizeFilename(file.getString("filename"));
                Uri created = downloadIntoFolder(file.getString("url"), filename, folder);
                JSObject result = new JSObject();
                result.put("message", filename + " dipasang ke folder mods pilihanmu.");
                result.put("uri", created.toString());
                call.resolve(result);
            } catch (Exception error) {
                Log.e(TAG, "Mod install failed", error);
                call.reject(error.getMessage() == null ? "Pemasangan mod gagal." : error.getMessage());
            }
        });
    }

    @Nullable
    private Uri getModsFolderUri() {
        String value = getContext().getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE).getString(MODS_FOLDER, null);
        if (value == null) return null;
        return Uri.parse(value);
    }

    private JSONObject findCompatibleFile(String projectId, String gameVersion) throws Exception {
        String versions = URLEncoder.encode("[\"" + gameVersion + "\"]", "UTF-8");
        String loaders = URLEncoder.encode("[\"fabric\"]", "UTF-8");
        URL api = new URL("https://api.modrinth.com/v2/project/" + projectId + "/version?game_versions=" + versions + "&loaders=" + loaders);
        HttpURLConnection connection = (HttpURLConnection) api.openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("User-Agent", "NoomLauncher/1.0 (https://github.com/himamsuper-cpu/la)");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) throw new Exception("Tidak ada versi mod Fabric yang cocok dengan game ini.");
            JSONArray versionsList = new JSONArray(readText(connection.getInputStream()));
            for (int i = 0; i < versionsList.length(); i++) {
                JSONArray files = versionsList.getJSONObject(i).optJSONArray("files");
                if (files == null || files.length() == 0) continue;
                for (int j = 0; j < files.length(); j++) {
                    JSONObject file = files.getJSONObject(j);
                    if (file.optBoolean("primary")) return file;
                }
                return files.getJSONObject(0);
            }
            throw new Exception("Mod tidak memiliki file yang cocok untuk versi ini.");
        } finally {
            connection.disconnect();
        }
    }

    private Uri downloadIntoFolder(String address, String filename, Uri folder) throws Exception {
        URL url = new URL(address);
        if (!"https".equals(url.getProtocol()) || !(url.getHost().equals("modrinth.com") || url.getHost().endsWith(".modrinth.com"))) {
            throw new Exception("Tautan unduhan mod tidak tepercaya.");
        }
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent", "NoomLauncher/1.0 (https://github.com/himamsuper-cpu/la)");
        Uri output = null;
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) throw new Exception("Unduhan mod gagal.");
            output = DocumentsContract.createDocument(getContext().getContentResolver(), folder, "application/java-archive", filename);
            if (output == null) throw new Exception("Folder mods tidak dapat ditulisi.");
            try (InputStream input = connection.getInputStream(); OutputStream destination = getContext().getContentResolver().openOutputStream(output, "w")) {
                if (destination == null) throw new Exception("Berkas mod tidak dapat dibuat.");
                byte[] buffer = new byte[32768];
                int count;
                while ((count = input.read(buffer)) != -1) destination.write(buffer, 0, count);
            }
            return output;
        } catch (Exception error) {
            if (output != null) {
                try { DocumentsContract.deleteDocument(getContext().getContentResolver(), output); } catch (Exception ignored) { }
            }
            throw error;
        } finally {
            connection.disconnect();
        }
    }

    private String readText(InputStream input) throws Exception {
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
        }
        return text.toString();
    }

    private String sanitizeFilename(String value) throws Exception {
        String filename = value.replaceAll("[^A-Za-z0-9._() -]", "_");
        if (!filename.toLowerCase().endsWith(".jar") || filename.equals(".jar")) throw new Exception("File mod tidak valid.");
        return filename;
    }
}