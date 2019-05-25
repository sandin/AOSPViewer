// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

let g_aosp_url = null;
let g_versions = null;

function parse_aosp_url(url) {
  let tmp = url.split("/+/");
  if (tmp.length != 2) {
    return null;
  }
  let base_url = tmp[0];
  let path_url = tmp[1];

  tmp = path_url.split("/");
  if (tmp.length < 4) {
    return null;
  }

  let type = tmp[1];         
  let version = tmp[2]; 
  //alert("type=" + type + ", version=" + version);
  path_url = tmp.slice(3).join("/");
  //alert("path_url=" + path_url);

  // eg: "https://android.googlesource.com/platform/art/+/refs/tags/android-4.4.3_r1/runtime/dex_file.cc"
  return {
    base_url: base_url, // "https://android.googlesource.com/platform/art"
    type: type,         // "tags" 
    version: version,   // "android-4.4.3_r1"
    path_url: path_url,  // "runtime/dex_file.cc"

    get_refs_index_url: function() {
       return this.base_url + "/+refs?format=TEXT" 
    },
    get_version_url: function(version) { 
      return this.base_url + "/+/refs/tags/" + version + "/" + this.path_url;
    }
  };
}

function onListItemClick(e) {
  let version = e.target.innerHTML;

  if (g_aosp_url && version) {
    let url = g_aosp_url.get_version_url(version);
    //alert("onItemClicked: " + url);

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.executeScript(
          tabs[0].id,
          {code: "window.location.href = \"" + url + "\";"});
    });
  }
}

function onFilterChecked(e) {
  if (g_versions) {
    var filter = e.target.checked;
    if (filter) {
      refreshUI(g_versions.filter(v => { return v.endsWith("_r1"); } ));
    } else {
      refreshUI(g_versions);
    }
    return true;
  }
  return false;
}

function refreshUI(versions) {
  const ul = document.getElementById("versionList");
  if (versions && versions.length > 0) {
    ul.innerHTML = "";
    versions.forEach(version => {
      let li = document.createElement("li");
      let a = document.createElement("a");
      a.innerHTML = version;
      a.addEventListener("click", onListItemClick);
      li.appendChild(a);
      ul.appendChild(li);
    });

    document.getElementById("filter").addEventListener("change", onFilterChecked);
  } else {
    ul.innerHTML = "<li><a><[error] no versions</a></li>";
    alert("Can not get versions");
  }
}

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  g_aosp_url = parse_aosp_url(tabs[0].url);
  if (g_aosp_url) {
    document.getElementById("state").innerHTML = "Fetching..";
    fetch(g_aosp_url.get_refs_index_url())
      .then(resp => resp.text())
      .then(data => {
        //alert("Got index");
        let versions = [];
        data.split("\n").forEach(line => {
          let match = line.match(/^[^ ]* refs\/tags\/(.*)$/);
          if (match) {
            let version = match[1].trim();
            if (version.match(/^android-\d+\.\d+\.\d+_r\d+$/i)) {
              versions.push(version);
            }
          }
        });
        versions.reverse();
        g_versions = versions;
        if (document.getElementById("filter").checked) {
          refreshUI(g_versions.filter(v => { return v.endsWith("_r1"); } ));
        } else {
          refreshUI(g_versions);
        }
      });
  } else {
    alert("can not parse url " + tabs[0].url);
  }
});

let changeColor = document.getElementById('changeColor');

chrome.storage.sync.get('color', function(data) {
  changeColor.style.backgroundColor = data.color;
  changeColor.setAttribute('value', data.color);
});

changeColor.onclick = function(element) {
  let color = element.target.value;
 
};
