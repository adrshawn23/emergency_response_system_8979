import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const IDUploadSection = ({ 
  formData, 
  errors, 
  onChange 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const acceptedFileTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf']
  };

  const maxFileSize = 5 * 1024 * 1024; // 5MB

  const handleDrag = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (e?.type === "dragenter" || e?.type === "dragover") {
      setDragActive(true);
    } else if (e?.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDragActive(false);
    
    if (e?.dataTransfer?.files && e?.dataTransfer?.files?.[0]) {
      handleFiles(e?.dataTransfer?.files);
    }
  };

  const handleChange = (e) => {
    e?.preventDefault();
    if (e?.target?.files && e?.target?.files?.[0]) {
      handleFiles(e?.target?.files);
    }
  };

  const handleFiles = (files) => {
    const file = files?.[0];
    
    // Validate file type
    if (!Object.keys(acceptedFileTypes)?.includes(file?.type)) {
      onChange({ 
        target: { 
          name: 'idDocumentError', 
          value: 'Please upload a valid image (JPG, PNG, WebP) or PDF file' 
        } 
      });
      return;
    }

    // Validate file size
    if (file?.size > maxFileSize) {
      onChange({ 
        target: { 
          name: 'idDocumentError', 
          value: 'File size must be less than 5MB' 
        } 
      });
      return;
    }

    // Create preview URL for images
    let previewUrl = null;
    if (file?.type?.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    onChange({ 
      target: { 
        name: 'idDocument', 
        value: { file, previewUrl, name: file?.name, size: file?.size, type: file?.type }
      } 
    });
    
    // Clear any previous errors
    onChange({ target: { name: 'idDocumentError', value: '' } });
  };

  const removeFile = () => {
    if (formData?.idDocument?.previewUrl) {
      URL.revokeObjectURL(formData?.idDocument?.previewUrl);
    }
    onChange({ target: { name: 'idDocument', value: null } });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i))?.toFixed(2)) + ' ' + sizes?.[i];
  };

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return 'Image';
    if (type === 'application/pdf') return 'FileText';
    return 'File';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Identity Verification</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a clear photo of your government-issued ID (Driver's License, Passport, State ID, etc.) 
          for identity verification. This is required for all account types.
        </p>

        <div className="space-y-4">
          {!formData?.idDocument ? (
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-emergency ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : errors?.idDocument 
                    ? 'border-error bg-error/5' :'border-border hover:border-primary hover:bg-muted/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={Object.values(acceptedFileTypes)?.flat()?.join(',')}
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className={`p-4 rounded-full ${
                    dragActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon name="Upload" size={32} />
                  </div>
                </div>
                
                <div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    {dragActive ? 'Drop your ID document here' : 'Upload ID Document'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop your file here, or click to browse
                  </p>
                  
                  <Button variant="outline" size="sm">
                    <Icon name="FolderOpen" size={16} className="mr-2" />
                    Choose File
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Supported formats: JPG, PNG, WebP, PDF</p>
                  <p>Maximum file size: 5MB</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start space-x-4">
                {formData?.idDocument?.previewUrl ? (
                  <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <Image
                      src={formData?.idDocument?.previewUrl}
                      alt="ID Document Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
                    <Icon name={getFileIcon(formData?.idDocument?.type)} size={24} className="text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {formData?.idDocument?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(formData?.idDocument?.size)}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="flex items-center space-x-1 text-success">
                      <Icon name="CheckCircle" size={14} />
                      <span className="text-xs">Uploaded successfully</span>
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="text-destructive hover:text-destructive"
                >
                  <Icon name="Trash2" size={16} />
                </Button>
              </div>
            </div>
          )}

          {errors?.idDocument && (
            <div className="flex items-center space-x-2 text-error text-sm">
              <Icon name="AlertCircle" size={16} />
              <span>{errors?.idDocument}</span>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
          <div className="flex items-start space-x-3">
            <Icon name="Shield" size={20} className="text-primary mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Security & Privacy</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Your ID document is encrypted and stored securely</li>
                <li>• Only authorized personnel can access verification documents</li>
                <li>• Documents are automatically deleted after verification (30 days)</li>
                <li>• We comply with all data protection regulations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDUploadSection;