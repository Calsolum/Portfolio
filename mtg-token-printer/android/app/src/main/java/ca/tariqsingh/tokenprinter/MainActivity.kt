package ca.tariqsingh.tokenprinter

import android.graphics.Bitmap
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val prefs = Prefs(this)
        setContent {
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
                Surface(Modifier.fillMaxSize()) { App(prefs) }
            }
        }
    }
}

private sealed interface Screen {
    data object Home : Screen
    data object Settings : Screen
    data class Detail(val token: Token) : Screen
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App(prefs: Prefs) {
    var screen by remember { mutableStateOf<Screen>(if (prefs.serverUrl.isEmpty()) Screen.Settings else Screen.Home) }
    BackHandler(enabled = screen != Screen.Home) { screen = Screen.Home }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (val s = screen) {
                            Screen.Home -> "Token Printer"
                            Screen.Settings -> "Settings"
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
                Screen.Home -> HomeScreen(prefs) { screen = Screen.Detail(it) }
                Screen.Settings -> SettingsScreen(prefs) { screen = Screen.Home }
                is Screen.Detail -> DetailScreen(prefs, s.token)
            }
        }
    }
}

@Composable
private fun HomeScreen(prefs: Prefs, open: (Token) -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    Column {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Search") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Make your own") })
        }
        if (tab == 0) SearchTab(prefs, open) else CustomTab(open)
    }
}

@Composable
private fun SearchTab(prefs: Prefs, open: (Token) -> Unit) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Token>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val recent = remember { prefs.recent() }

    LaunchedEffect(query) {
        error = null
        if (query.trim().length < 2) {
            results = emptyList()
            return@LaunchedEffect
        }
        delay(400) // wait for typing to pause; a new keystroke cancels this
        loading = true
        try {
            results = Api(prefs.serverUrl).search(query.trim())
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
private fun DetailScreen(prefs: Prefs, token: Token) {
    val scope = rememberCoroutineScope()
    var preview by remember { mutableStateOf<Bitmap?>(null) }
    var previewError by remember { mutableStateOf<String?>(null) }
    var copies by remember { mutableIntStateOf(1) }
    var status by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(token) {
        try {
            preview = Api(prefs.serverUrl).preview(token)
        } catch (e: ApiException) {
            previewError = e.message
        }
    }

    Column(
        Modifier.padding(16.dp).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.fillMaxWidth(0.75f).aspectRatio(577f / 927f).border(1.dp, MaterialTheme.colorScheme.outline),
            contentAlignment = Alignment.Center,
        ) {
            val bitmap = preview
            when {
                bitmap != null -> Image(bitmap.asImageBitmap(), contentDescription = "Label preview", modifier = Modifier.fillMaxSize())
                previewError != null -> Text(previewError!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
                else -> CircularProgressIndicator()
            }
        }

        Row(Modifier.padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { copies-- }, enabled = copies > 1 && !busy) { Text("−") }
            Text("$copies ${if (copies == 1) "copy" else "copies"}", modifier = Modifier.padding(horizontal = 20.dp))
            OutlinedButton(onClick = { copies++ }, enabled = copies < 10 && !busy) { Text("+") }
        }

        Button(
            onClick = {
                busy = true
                failed = false
                status = "Sending to the printer…"
                scope.launch {
                    val api = Api(prefs.serverUrl)
                    try {
                        val job = api.print(token, copies)
                        prefs.addRecent(token)
                        status = waitForJob(api, job) { status = it }
                    } catch (e: ApiException) {
                        status = e.message?.let { if (it.startsWith("Print failed")) it else "Print failed: $it" }
                    }
                    failed = status?.startsWith("Print failed") == true
                    busy = false
                }
            },
            enabled = !busy && previewError == null,
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) { Text(if (busy) "Printing…" else "Print") }

        status?.let {
            Text(
                it,
                color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 16.dp),
            )
        }
    }
}

/** Polls the job until it finishes; returns the message to show. */
private suspend fun waitForJob(api: Api, job: String, progress: (String) -> Unit): String {
    repeat(90) {
        val s = api.status(job)
        when (s.state) {
            JobState.DONE -> return "Printed."
            JobState.FAILED -> return "Print failed: ${s.error ?: "unknown reason"}"
            JobState.QUEUED -> progress("Waiting for the printer…")
            JobState.PRINTING -> progress("Printing…")
        }
        delay(1_000)
    }
    return "Print failed: the printer didn't answer in time."
}

@Composable
private fun SettingsScreen(prefs: Prefs, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(prefs.serverUrl.ifEmpty { "http://" }) }
    var result by remember { mutableStateOf<String?>(null) }
    var ok by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Enter the Kitchen Hub label server's address, including the port, for example http://192.168.1.50:9300")
        OutlinedTextField(
            value = url,
            onValueChange = { url = it; result = null },
            label = { Text("Pi address") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = {
                result = "Checking…"
                scope.launch {
                    try {
                        result = Api(url).health()
                        ok = true
                    } catch (e: ApiException) {
                        result = e.message
                        ok = false
                    }
                }
            }) { Text("Test") }
            Button(onClick = { prefs.serverUrl = url; done() }, enabled = url.length > "http://".length) { Text("Save") }
        }
        result?.let { Text(it, color = if (ok || it == "Checking…") MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error) }
        Spacer(Modifier.size(8.dp))
        Text(
            "Token data and art come from Scryfall. Token Printer ${context.packageManager.getPackageInfo(context.packageName, 0).versionName}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
