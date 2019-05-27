// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

const CACHE_EXPIRE =  24 * 60 * 60 * 1000; // 24h
//const CACHE_EXPIRE =  10 * 60 * 1000; // 10min

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
  let type = null; // "tags", "heads", null
  let version = null;
  if (tmp[0] == "refs") {
    type = tmp[1];         
    version = tmp[2]; 
    path_url = tmp.slice(3).join("/");
  } else { 
    version = tmp[0] 
    path_url = tmp.slice(1).join("/");
  }
  //alert("path_url=" + path_url);

  // eg: "https://android.googlesource.com/platform/art/+/refs/tags/android-4.4.3_r1/runtime/dex_file.cc"
  // or: "https://android.googlesource.com/platform/art/+/android-4.4.3_r1/runtime/dex_file.cc"
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
    },
    get_master_url: function() {
      return this.base_url + "/+/refs/heads/" + "master" + "/" + this.path_url;
    }
  };
}

function onListItemClick(e) {
  let version = e.target.innerHTML;

  if (g_aosp_url && version) {
    let url;
    if (version == "master") {
      url = g_aosp_url.get_master_url();
    } else {
      url = g_aosp_url.get_version_url(version);
    }
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
    versions.splice(0, 0, 'master'); // versions.insert(0, 'master');
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

function onVersionsLoad(versions) {
  g_versions = versions;
  if (document.getElementById("filter").checked) {
    refreshUI(g_versions.filter(v => { return v.endsWith("_r1"); } ));
  } else {
    refreshUI(g_versions);
  }
}

function parse_refs_index(data) {
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
  return versions;
}

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  g_aosp_url = parse_aosp_url(tabs[0].url);
  if (g_aosp_url) {
    document.getElementById("state").innerHTML = "Fetching..";
    const index_url = g_aosp_url.get_refs_index_url();

    chrome.storage.local.get(index_url, function(result) {
      let cache = typeof(result[index_url]) != "undefined" ? result[index_url] : null;
      let valid = cache != null 
                 && typeof(cache.versions != 'undefined') 
                 && typeof(cache.time != 'undefined') 
                 && new Date().getTime() < cache.time + CACHE_EXPIRE;
      //alert("get cache by key: " + index_url + ", value=" + cache + ", valid=" + valid);
      let versions = valid ? cache.versions : null;
      if (versions && versions.length > 0) {
        onVersionsLoad(versions);
      } else {
        fetch(index_url).then(resp => resp.text()).then(data => {
          let versions = parse_refs_index(data);
          let cache = {};
          cache[index_url] = {
            versions: versions,
            time: new Date().getTime()
          }
          chrome.storage.local.set(cache, function() {});
          onVersionsLoad(versions);
        }).cache(e => alert("Error: " + e));
      }
    });
  } else {
    alert("can not parse url " + tabs[0].url);
  }
});
