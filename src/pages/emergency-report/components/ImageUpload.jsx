import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ImageUpload = ({ 
  images, 
  onImagesChange, 
  maxImages = 5,
  error = null 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

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
    
    const files = Array.from(e?.dataTransfer?.files);
    handleFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e?.target?.files);
    handleFiles(files);
  };

  const handleFiles = (files) => {
    const imageFiles = files?.filter(file => file?.type?.startsWith('image/'));
    
    if (images?.length + imageFiles?.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    const newImages = imageFiles?.map(file => ({
      id: Date.now() + Math.random(),
      file,
      url: URL.createObjectURL(file),
      name: file?.name,
      size: file?.size
    }));

    onImagesChange([...images, ...newImages]);
  };

  const removeImage = (imageId) => {
    const updatedImages = images?.filter(img => img?.id !== imageId);
    onImagesChange(updatedImages);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i))?.toFixed(2)) + ' ' + sizes?.[i];
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Evidence Photos (Optional)
        </label>
        
        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-emergency ${
            dragActive 
              ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Icon name="Upload" size={24} className="text-muted-foreground" />
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop images here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, GIF up to 10MB each (max {maxImages} images)
              </p>
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef?.current?.click()}
            >
              Choose Files
            </Button>
          </div>
        </div>

        {/* Image Previews */}
        {images?.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground mb-3">
              Uploaded Images ({images?.length}/{maxImages})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {images?.map((image) => (
                <div key={image?.id} className="relative group">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={image?.url}
                      alt={image?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeImage(image?.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-emergency"
                  >
                    <Icon name="X" size={14} />
                  </button>
                  
                  <div className="mt-2">
                    <p className="text-xs text-foreground truncate" title={image?.name}>
                      {image?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(image?.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center space-x-1">
          <Icon name="AlertCircle" size={16} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default ImageUpload;