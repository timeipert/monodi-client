function DocumentListCtrl($scope) {
	$scope.toggle = function() {
		var $checkboxes = $('.fileList input[type="checkbox"]');
		if ($checkboxes.first().prop('checked') == true) {
			$checkboxes.prop('checked', true);
		} else {
			$checkboxes.prop('checked', false);
		}
	};

	$scope.openDocument = function(id) {
		$scope.setInfoDocument(id);
		$scope.$emit('openDocumentRequest', { id: id });
	};

	$scope.checkDocumentSync = function(id) {
		if ($scope.isOnSyncList(id) &&
			!confirm('Your work on document ' + JSON.parse(localStorage['document' + id]).title + ' was not sent to the server yet. Unless you cancel this operation, your edits will be lost.')) {
			return false;
		}

		return true;
	};

	$scope.removeDocument = function(id, callback) {
		if (!callback) {
			if (!confirm('Delete document?')) {
				return false;
			}
		}

		if (!$scope.checkDocumentSync(id)) {
			return false;
		}

		$scope.removeLocal(id);
		$scope.deleteDocument(id, callback);
		$scope.removeFromSyncList(id);
	};

	$scope.removeDocumentBatch = function() {
		if (!confirm('Delete documents?')) {
			return false;
		}

		var ids = getBatchDocuments(),
			callback = function() {
				if (ids.length) $scope.removeDocument(ids.shift(), callback);
			};

		callback();
	};

	var print = function(documents) {
		var printDivs = monodi.document.getPrintHtml(documents).querySelectorAll("html > body > *");
		$('#printContainer').append(printDivs).show(0, function(){
			window.print();
			window.setTimeout(function(){
				$('#printContainer').hide().children('.mei').remove();
			}, 600);
		});
	};

	$scope.printBatch = function(ids, documents) {
		ids = ids || getBatchDocuments();
		documents = documents || [];
		
		$scope.getDocument(ids.shift(), function() {
			documents.push(this.content);
			if (ids.length > 0) {
				$scope.printBatch(ids, documents);
			} else {
				print(documents);
			}
		});
	};

	$scope.print = function(id) {
		$scope.getDocument(id, function() {
			print([this.content]);
		});
	};

	$scope.saveDocumentLocal = function(id, callback) {
		$scope.getDocument(id, function() {
			$scope.addToDocumentList(id, this);

			if (callback) callback();
		});
	};

	$scope.saveLocalBatch = function() {
		var ids = getBatchDocuments(),
			callback = function() {
				if (ids.length) $scope.saveDocumentLocal(ids.shift(), callback);
			};

		callback();
	};

	$scope.removeDocumentLocal = function(id) {
		if (!$scope.checkDocumentSync(id)) {
			return false;
		}

		$scope.removeLocal('document' + id);
		var documentList = $scope.getLocal('documentList');
		if (documentList) {
			$scope.setLocal('documentList', documentList.replace(' ' + id + ',', ''));
		}
		$scope.setDocumentLocalAttr(id, false);
	};

	$scope.removeLocalBatch = function() {
		angular.forEach(getBatchDocuments(), function(el) {
			$scope.removeDocumentLocal(el);
		});
	};

	$scope.documentinfo = function(id) {
		$scope.setInfoDocument(id);
		$scope.showDocumentInfo();
	};

	$scope.addFolder = function(path) {
		$scope.createFolder.path = path;
		$('#createFolderModal').modal('show');
	};

	var checkFolderExists = function(documents, folder, pathParts, level) {
		var path = '',
			exists = false;

		if (pathParts) {
			for (var i = 0; i <= level; i++) {
				path += pathParts[i] + '/';
			}
			path = path.slice(0, - 1);
			level++;
		}

		angular.forEach(documents, function(el) {
			if (el.path == path) {
				if (level == pathParts.length) {
					if (el.children_count > 0) {
						angular.forEach(el.folders, function(exist) {
							if (folder.title == exist.title || path + '/' + folder.path == exist.path) {
								exists = true;
							}
						});
					}
				}

				if (!exists && el.children_count > 0) {
					exists = checkFolderExists(el.folders, folder, pathParts, level);
				}
			}
		});

		return exists;
	};
	var addFolder = function(documents, folder, pathParts, level) {
		var path = '',
			parent = false;

		if (pathParts) {
			for (var i = 0; i <= level; i++) {
				path += pathParts[i] + '/';
			}
			path = path.slice(0, - 1);
			level++;
		}

		angular.forEach(documents, function(el) {
			if (el.path == path) {
				if (level == pathParts.length) {
					el.children_count++;
					folder.root = el.id;
					folder.path = path + '/' + folder.path;
					el.folders.push(folder);
					parent = path;
					return true;
				}

				if (!parent && el.children_count > 0) {
					parent = addFolder(el.folders, folder, pathParts, level);
				}
			}
		});

		return parent;
	};
	$scope.createFolder = function(foldername) {
		if (!/^[A-z0-9_\-\s]+$/.test(foldername)) {
			alert('Foldername is invalid');
			return false;
		}

		var path = $scope.createFolder.path,
			pathParts = (path)? path.split('/') : false,
			id = 'temp' + new Date().getTime(),
			folder = {
				id: id,
				children_count: 0,
				document_count: 0,
				documents: [],
				folders: [],
				path: foldername.toLowerCase().replace(' ', '-'),
				root: id,
				title: foldername
			};

		if (checkFolderExists($scope.documents, folder, pathParts, 0)) {
			alert('Foldername already exists.');
			return false;
		}

		if (pathParts) {
			path = addFolder($scope.documents, folder, pathParts, 0);
		} else {
			$scope.documents.push(folder);
		}

		$scope.postNewFolderToServer(path, foldername, id);
		$('#createFolderModal').modal('hide');
	};

	var checkFileExists = function(documents, file, pathParts, level) {
		var path = '',
			exists = false;

		if (pathParts) {
			for (var i = 0; i <= level; i++) {
				path += pathParts[i] + '/';
			}
			path = path.slice(0, - 1);
			level++;
		}

		angular.forEach(documents, function(el) {
			if (el.path == path) {
				if (level == pathParts.length) {
					if (el.document_count > 0) {
						angular.forEach(el.documents, function(exist) {
							if (file == exist.filename) {
								exists = true;
							}
						});
					}
				}

				if (!exists && el.children_count > 0) {
					exists = checkFileExists(el.folders, file, pathParts, level);
				}
			}
		});

		return exists;
	};
	var addFile = function(documents, file, pathParts, level) {
		var path = '',
			found = false;
		for (var i = 0; i <= level; i++) {
			path += pathParts[i] + '/';
		}
		path = path.slice(0, - 1);
		level++;

		angular.forEach(documents, function(el) {
			if (el.path == path) {
				if (level == pathParts.length) {
					el.document_count++;
					el.documents.push(file);
					$scope.files.push(file);
					found = true;
				}

				if (!found && el.children_count > 0) {
					found = addFile(el.folders, file, pathParts, level);
				}
			}
		});

		return found;
	};
	$scope.saveNewDocumentHere = function(path) {
		var error = false,
			found;

		if (!$scope.active.title || !/^[A-z0-9_\-]+$/.test($scope.active.title)) {
			$('#fileName').focus();
			alert('Filename is invalid');
			return false;
		}

		var pathParts = path.split('/');
		if (!/\.mei$/.test($scope.active.title)) {
			$scope.active.filename = $scope.active.title + '.mei';
		} else {
			$scope.active.filename = $scope.active.title;
		}

		if (checkFileExists($scope.documents, $scope.active.filename, pathParts, 0)) {
			alert('Filename already exists.');
			return false;
		}

		document.title = "mono:di - " + $scope.active.filename;

		$scope.active.path = path;

		$scope.active.content = monodi.document.getSerializedDocument();
		$scope.active.id = 'temp' + new Date().getTime();

		found = addFile($scope.documents, $scope.active, pathParts, 0);
		if (!found) {
			alert('An error occurred and the document ' + $scope.active.filename + ' could not be saved. Please try to save the document again or contact the administrator.');
		}

		$scope.updateLocalDocuments();
		$scope.setLocal($scope.active.id, true);

		$scope.postNewDocumentToServer();

		$('.files.container').hide().removeClass('chooseDirectory');
		$('.modal-backdrop').remove();
		$('#savedModal').modal('show');
	};

	var getBatchDocuments = function() {
		return $('.fileviews').children(':visible').find(':checked').map( function() {
			return this.name;
		}).get();
	};
}
