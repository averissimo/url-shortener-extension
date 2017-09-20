const defaultKey = 'AIzaSyA61YQflGBiR2a-9q_C83kvb8c5kTifxRk'

/**
 * Checks if protocol is supported (only http and https)
 * @param  {string}  urlString link that is going to be validated
 * @return {Boolean}           [description]
 */
function isSupportedProtocol(urlString) {
  var supportedProtocols = ["https:", "http:"];
  var url = document.createElement('a');
  url.href = urlString;
  return supportedProtocols.indexOf(url.protocol) != -1;
}

/**
 * Shortens the link, copies to clipboard and notifies the firefox window
 * @param  {string} link url that should be shortened
 */
function shortenLink(link) {
  function executeCopyScript(evt) {
    var response = JSON.parse(evt.target.response);

    const code = "copyToClipboard(" +
                JSON.stringify(response.id) + ");";

    // console.log('Code being run in current tab', code);

    function copyInTab(tabId, noRecur=false) {
      browser.tabs.executeScript({
        code: "typeof copyToClipboard === 'function';",
        runAt: 'document_start',
        matchAboutBlank: true
      }).then(function(results) {
        // The content script's last expression will be true if the function
        // has been defined. If this is not the case, then we need to run
        // clipboard-helper.js to define function copyToClipboard.
        if (!results || results[0] !== true) {
          return browser.tabs.executeScript(tabId, {
            file: "/src/clipboard_helper.js",
            runAt: 'document_start',
            matchAboutBlank: true
          });
        }
      }).then(function(results2) {
        var retVal = browser.tabs.executeScript(tabId, {
          code: code,
          runAt: 'document_start',
          matchAboutBlank: true
        });
        // console.log('response', response)
        if (response.error !== undefined) {
          notify("notificationErrorKey", [response.error.errors[0].reason])
          return null
        }
        notifySuccess({url: link, shortUrl: response.id});
        return retVal
      }, function(error){
        if(noRecur) {
          // console.log('Going to try tab.id 1')
          copyInTab(1, false);
        } else {
          if (error.message && /Missing host permission for the tab/.test(error.message)) {
            notifyHostError({info: error, url: link, shortUrl: response.id});
          } else {
            notifyClipboardError({info: error, url: link, shortUrl: response.id});
          }
        }
      }).then(function() {
        // console.log('success!!')
      });
    }
    var gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
    gettingActiveTab.then(function(tabs) {
      if(tabs[0]) {
        copyInTab(tabs[0].id, true)
      } else {
        // console.error("Failed to copy text: no active tab");
      }
    })
  }

  if (isSupportedProtocol(link)) {
    // Send link to API
    browser.storage.local.get('prefs').then(ret => {

      let item = ret['prefs'] || { key: defaultKey }

      if (item === undefined || item.key === undefined || item.key.trim() === '' ) {
        item.key = defaultKey
      }

      var basename = "https://www.googleapis.com";
      var urlfrag = "/urlshortener/v1/url?key=" + item.key;
      var longUrl = encodeURIComponent(link);
      //
      // console.log('Calling ' + basename + urlfrag + ' with ' + JSON.stringify({"longUrl": link}));
      // POST request
      var xhr = new XMLHttpRequest();
      xhr.addEventListener("load", executeCopyScript);
      xhr.addEventListener("error", notifyNetworkError);
      xhr.open("POST", basename + urlfrag, true);
      // Send the proper header information along with the request
      xhr.setRequestHeader("Content-type", "application/json");
      xhr.send(JSON.stringify({"longUrl": link}));
      // console.log('request', xhr);
    });
  } else {
    // Do nothing TODO: disable icon on these tabs
    notifyNetworkProtocol(link);
  }
}

/**
 * Notify error message
 * @param  {[type]} messageType [description]
 * @param  {[type]} messageArray [description]
 * @return {[type]}         [description]
 */
function notify(messageType = "notificationErrorGeneric", messageArray = []) {
  var title = browser.i18n.getMessage("notificationTitle");
  var content = browser.i18n.getMessage(messageType, messageArray);
  // console.log('Error: ' + content)
  browser.notifications.create({
    "type": "basic",
    "iconUrl": browser.extension.getURL("icons/icon-48.png"),
    "title": title,
    "message": content
  });
}

/**
 * [notifySuccess description]
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
function notifySuccess(message) {
  notify("notificationContent", [message.url, message.shortUrl]);
}

/**
 * Notify host copy error message
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
function notifyHostError(message) {
  notify("notificationErrorHost", [message.info, message.url, message.shortUrl]);
}

/**
 * Notify generic clipboard copy error message
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
function notifyClipboardError(message) {
  notify("notificationErrorClipboard", [message.info, message.url, message.shortUrl]);
}

/**
 * Notify network error message
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
function notifyNetworkError() {
  notify("notificationErrorNetwork", []);
}

/**
 * Notify protocol error message
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
function notifyNetworkProtocol(url) {
  notify("notificationErrorProtocol", [url]);
}
