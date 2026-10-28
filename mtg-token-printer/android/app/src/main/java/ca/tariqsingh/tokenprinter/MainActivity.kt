package ca.tariqsingh.tokenprinter

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val prefs = Prefs(this)
        val deps = Deps(prefs, Scryfall(cacheDir), B1Printer(applicationContext, prefs))
        setContent {
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
                Surface(Modifier.fillMaxSize()) { App(deps) }
            }
        }
    }
}

private class Deps(val prefs: Prefs, val scryfall: Scryfall, val printer: B1Printer)

/** Bluetooth permissions this Android version needs before scanning and connecting. */
private val bluetoothPermissions: Array<String> =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }

private sealed interface Screen {
    data object Home : Screen
    data object Settings : Screen
    data class Detail(val token: Token) : Screen
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App(deps: Deps) {
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    BackHandler(enabled = screen != Screen.Home) { screen = Screen.Home }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (val s = screen) {
                            Screen.Home -> "Token Printer"
                            Screen.Settings -> "Printer"
                            is Screen.Detail -> s.token.name
                        },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    if (screen != Screen.Home) {
                        IconButton(onClick = { screen = Screen.Home }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                actions = {
                    if (screen == Screen.Home) {
                        IconButton(onClick = { screen = Screen.Settings }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (val s = screen) {
                Screen.Home -> HomeScreen(deps) { screen = Screen.Detail(it) }
                Screen.Settings -> PrinterScreen(deps.prefs)
                is Screen.Detail -> DetailScreen(deps, s.token)
            }
        }
    }
}

@Composable
private fun HomeScreen(deps: Deps, open: (Token) -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    Column {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Search") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Make your own") })
        }
        if (tab == 0) SearchTab(deps, open) else CustomTab(open)
    }
}

@Composable
private fun SearchTab(deps: Deps, open: (Token) -> Unit) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Token>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val recent = remember { deps.prefs.recent() }

    LaunchedEffect(query) {
        error = null
        if (query.trim().length < 2) {
            results = emptyList()
            return@LaunchedEffect
        }
        delay(400) // wait for typing to pause; a new keystroke cancels this
        loading = true
        try {
            results = deps.scryfall.search(query.trim())
            if (results.isEmpty()) error = "No tokens match \"${query.trim()}\"."
        } catch (e: ApiException) {
            error = e.message
        } finally {
            loading = false
        }
    }

    Column(Modifier.padding(horizontal = 16.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search tokens (e.g. goblin, treasure, 1/1 soldier)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        if (loading) CircularProgressIndicator(Modifier.padding(16.dp).align(Alignment.CenterHorizontally))
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 12.dp)) }

        val showingRecent = query.trim().length < 2
        val list = if (showingRecent) recent else results
        if (showingRecent && recent.isNotEmpty()) {
            Text("Printed recently", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
        }
        LazyColumn {
            items(list, key = { (it.id ?: "custom") + it.name + it.typeLine }) { token ->
                TokenRow(token) { open(token) }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun TokenRow(token: Token, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (token.thumbUrl != null) {
            AsyncImage(model = token.thumbUrl, contentDescription = null, modifier = Modifier.width(56.dp).aspectRatio(0.716f))
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(token.name, fontWeight = FontWeight.SemiBold)
            Text(token.typeLine, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (token.setName.isNotEmpty()) {
                Text(token.setName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        token.pt?.let { Text(it, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 8.dp)) }
    }
}

@Composable
private fun CustomTab(open: (Token) -> Unit) {
    var name by remember { mutableStateOf("") }
    var typeLine by remember { mutableStateOf("Token Creature — ") }
    var power by remember { mutableStateOf("") }
    var toughness by remember { mutableStateOf("") }
    var text by remember { mutableStateOf("") }

    Column(
        Modifier.padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(typeLine, { typeLine = it }, label = { Text("Type line") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(power, { power = it.take(4) }, label = { Text("Power") }, singleLine = true, modifier = Modifier.weight(1f))
            OutlinedTextField(toughness, { toughness = it.take(4) }, label = { Text("Toughness") }, singleLine = true, modifier = Modifier.weight(1f))
        }
        OutlinedTextField(text, { text = it }, label = { Text("Rules text (optional)") }, minLines = 3, modifier = Modifier.fillMaxWidth())
        Button(
            onClick = {
                open(
                    Token(
                        id = null,
                        name = name.trim(),
                        typeLine = typeLine.trim().removeSuffix("—").trim(),
                        text = text.trim(),
                        power = power.trim().ifEmpty { null },
                        toughness = toughness.trim().ifEmpty { null },
                    ),
                )
            },
            enabled = name.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Preview") }
    }
}

@Composable
private fun DetailScreen(deps: Deps, token: Token) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var label by remember { mutableStateOf<Bitmap?>(null) }
    var copies by remember { mutableIntStateOf(1) }
    var status by remember { mutableStateOf<String?>(null) }
    var progress by remember { mutableFloatStateOf(0f) }
    var failed by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(token) {
        val art = deps.scryfall.art(token.artUrl)
        label = withContext(Dispatchers.Default) { LabelRenderer.render(token, art) }
    }

    fun startPrint() {
        val bitmap = label ?: return
        busy = true
        failed = false
        scope.launch {
            try {
                val black = withContext(Dispatchers.Default) { toPrintBits(bitmap) }
                deps.printer.print(black, bitmap.height, copies) { message, fraction ->
                    status = message
                    progress = fraction
                }
                deps.prefs.addRecent(token)
                status = if (copies == 1) "Printed." else "Printed $copies copies."
            } catch (e: ApiException) {
                failed = true
                status = e.message?.let { if (it.startsWith("Print failed")) it else "Print failed: $it" }
            } catch (e: SecurityException) {
                failed = true
                status = "Print failed: Bluetooth permission was refused."
            } finally {
                busy = false
            }
        }
    }

    val askPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.all { it }) {
            startPrint()
        } else {
            failed = true
            status = "Print failed: Token Printer needs Bluetooth permission to reach the printer."
        }
    }

    Column(
        Modifier.padding(16.dp).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.fillMaxWidth(0.75f).aspectRatio(LabelRenderer.WIDTH.toFloat() / LabelRenderer.HEIGHT).border(1.dp, MaterialTheme.colorScheme.outline),
            contentAlignment = Alignment.Center,
        ) {
            val bitmap = label
            if (bitmap != null) {
                Image(bitmap.asImageBitmap(), contentDescription = "Label preview", modifier = Modifier.fillMaxSize())
            } else {
                CircularProgressIndicator()
            }
        }

        Row(Modifier.padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { copies-- }, enabled = copies > 1 && !busy) { Text("−") }
            Text("$copies ${if (copies == 1) "copy" else "copies"}", modifier = Modifier.padding(horizontal = 20.dp))
            OutlinedButton(onClick = { copies++ }, enabled = copies < 10 && !busy) { Text("+") }
        }

        Button(
            onClick = {
                val missing = bluetoothPermissions.filter {
                    ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
                }
                if (missing.isEmpty()) startPrint() else askPermission.launch(missing.toTypedArray())
            },
            enabled = !busy && label != null,
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) { Text(if (busy) "Printing…" else "Print") }

        if (busy) LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().padding(top = 16.dp))
        status?.let {
            Text(
                it,
                color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 16.dp),
            )
        }
    }
}

/** The label as print dots: black = true, placed on the printer's 640-wide bitmap. */
private fun toPrintBits(label: Bitmap): BooleanArray {
    val w = label.width
    val h = label.height
    val pixels = IntArray(w * h)
    label.getPixels(pixels, 0, w, 0, 0, w, h)
    val black = BooleanArray(pixels.size) { Dither.luma(pixels[it]) < 128 }
    return Niimbot.onPrintCanvas(black, w, h)
}

@Composable
private fun PrinterScreen(prefs: Prefs) {
    val context = LocalContext.current
    var address by remember { mutableStateOf(prefs.printerAddress) }

    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Token Printer prints straight to the NIIMBOT B1 over Bluetooth. Load the 50×80 mm labels and turn the printer on.")
        Text(
            "The printer takes one connection at a time, so it has to be free: not connected to the Kitchen Hub or the NIIMBOT app.",
            style = MaterialTheme.typography.bodySmall,
        )
        Text(if (address != null) "Remembered printer: $address" else "No printer remembered yet. The first print finds it.")
        if (address != null) {
            OutlinedButton(onClick = { prefs.printerAddress = null; address = null }) { Text("Forget this printer") }
        }
        Spacer(Modifier.size(8.dp))
        Text(
            "Token data and art come from Scryfall. Token Printer ${context.packageManager.getPackageInfo(context.packageName, 0).versionName}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
